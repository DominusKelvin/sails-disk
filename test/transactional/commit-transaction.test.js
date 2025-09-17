var assert = require('assert');
var _ = require('@sailshq/lodash');
var Adapter = require('../../');

describe('Transactional ::', function() {
  describe('Commit Transaction', function() {
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

    it('should commit a transaction and persist changes', function(done) {
      // Begin transaction
      Adapter.beginTransaction(datastoreName, { connection: connection }, function(err) {
        if (err) {
          return done(err);
        }

        // Create a record during the transaction
        Adapter.create(datastoreName, {
          using: 'user',
          newRecord: {
            id: 'test-user-1',
            name: 'Test User'
          }
        }, function(err) {
          if (err) {
            return done(err);
          }

          // Verify record exists during transaction
          Adapter.find(datastoreName, {
            using: 'user',
            criteria: { where: { id: 'test-user-1' } }
          }, function(err, records) {
            if (err) {
              return done(err);
            }

            assert.equal(records.length, 1, 'Record should exist during transaction');

            // Commit the transaction
            Adapter.commitTransaction(datastoreName, { connection: connection }, function(err) {
              if (err) {
                return done(err);
              }

              // Verify transaction is no longer active
              assert.strictEqual(connection.transactionContext.isActive, false, 'Transaction should not be active after commit');

              // Verify record still exists after commit
              Adapter.find(datastoreName, {
                using: 'user',
                criteria: { where: { id: 'test-user-1' } }
              }, function(err, records) {
                if (err) {
                  return done(err);
                }

                assert.equal(records.length, 1, 'Record should persist after commit');
                assert.equal(records[0].name, 'Test User', 'Record data should be correct');

                return done();
              });
            });
          });
        });
      });
    });
  });
});