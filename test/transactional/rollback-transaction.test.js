/* global describe, before, after, it */
var assert = require('assert');
var _ = require('@sailshq/lodash');
var Adapter = require('../../');

describe('Transactional ::', function() {
  describe('Rollback Transaction', function() {
    var datastoreName = 'transactional-test';
    var connection;

    // Register datastore
    before(function(done) {
      var config = {
        identity: datastoreName,
        inMemoryOnly: true
      };

      var models = {
        user: {
          identity: 'user',
          tableName: 'user',
          primaryKey: 'id',
          definition: {
            id: {
              type: 'string',
              columnName: 'id'
            },
            name: {
              type: 'string',
              columnName: 'name'
            }
          }
        }
      };

      Adapter.registerDatastore(config, models, function(err) {
        if (err) {
          return done(err);
        }

        // Get a connection for the transaction
        Adapter.leaseConnection(datastoreName, {}, function(err, leased) {
          if (err) {
            return done(err);
          }
          connection = leased;
          done();
        });
      });
    });

    // Clean up
    after(function(done) {
      Adapter.releaseConnection(connection, function() {
        Adapter.teardown(datastoreName, done);
      });
    });

    it('should rollback a transaction and revert changes', function(done) {
      // First, create an initial record to test rollback
      Adapter.create(datastoreName, {
        using: 'user',
        newRecord: {
          id: 'existing-user',
          name: 'Existing User'
        }
      }, function(err) {
        if (err) {
          return done(err);
        }

        // Begin transaction
        Adapter.beginTransaction(datastoreName, { connection: connection }, function(err) {
          if (err) {
            return done(err);
          }

          // Create a record during the transaction
          Adapter.create(datastoreName, {
            using: 'user',
            newRecord: {
              id: 'test-user-rollback',
              name: 'Test User Rollback'
            }
          }, function(err) {
            if (err) {
              return done(err);
            }

            // Update the existing record during transaction
            Adapter.update(datastoreName, {
              using: 'user',
              criteria: { where: { id: 'existing-user' } },
              valuesToSet: { name: 'Modified Existing User' }
            }, function(err) {
              if (err) {
                return done(err);
              }

              // Verify both changes exist during transaction
              Adapter.find(datastoreName, {
                using: 'user',
                criteria: { where: {} }
              }, function(err, records) {
                if (err) {
                  return done(err);
                }

                assert.equal(records.length, 2, 'Should have 2 records during transaction');
                var existingUser = _.find(records, { id: 'existing-user' });
                var newUser = _.find(records, { id: 'test-user-rollback' });

                assert(existingUser, 'Existing user should be found');
                assert(newUser, 'New user should be found');
                assert.equal(existingUser.name, 'Modified Existing User', 'Existing user should be modified');

                // Rollback the transaction
                Adapter.rollbackTransaction(datastoreName, { connection: connection }, function(err) {
                  if (err) {
                    return done(err);
                  }

                  // Verify transaction is no longer active
                  assert.strictEqual(connection.transactionContext.isActive, false, 'Transaction should not be active after rollback');

                  // Verify changes were rolled back
                  Adapter.find(datastoreName, {
                    using: 'user',
                    criteria: { where: {} }
                  }, function(err, records) {
                    if (err) {
                      return done(err);
                    }

                    // Should only have the original record, and it should be unchanged
                    assert.equal(records.length, 1, 'Should only have 1 record after rollback');
                    assert.equal(records[0].id, 'existing-user', 'Should have the existing user');
                    assert.equal(records[0].name, 'Existing User', 'Existing user should be unchanged after rollback');

                    return done();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});