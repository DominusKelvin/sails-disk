var assert = require('assert');
var _ = require('@sailshq/lodash');
var Adapter = require('../../');

describe('Transactional ::', function() {
  describe('Begin Transaction', function() {
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

    it('should begin a transaction and set up transaction context', function(done) {
      // Verify connection has transaction context
      assert(connection.transactionContext, 'Connection should have transaction context');
      assert.strictEqual(connection.transactionContext.isActive, false, 'Transaction should not be active initially');
      
      // Begin transaction
      Adapter.beginTransaction(datastoreName, { connection: connection }, function(err) {
        if (err) {
          return done(err);
        }

        // Verify transaction is now active
        assert.strictEqual(connection.transactionContext.isActive, true, 'Transaction should be active after begin');
        assert(connection.transactionContext.snapshots, 'Transaction should have snapshots');
        
        return done();
      });
    });
  });
});