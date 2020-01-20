let _ = require('lodash');
let async = require('async');
let pg = require('pg');

let util = require('../../core/util.js');
let config = util.getConfig();
let dirs = util.dirs();
let postgresUtil = require('./util');

let connectionString = config.postgresql.connectionString;


module.exports = done => {
  let scanClient = new pg.Client(connectionString + '/postgres');

  let markets = [];

  scanClient.connect(function(err) {
    if (err) {
      util.die(err);
    }

    let sql = 'select datname from pg_database';

    // In single DB setup we don't need to go look into other DBs
    if (postgresUtil.useSingleDatabase()) {
      sql = 'select datname from pg_database where datname=\'' + postgresUtil.database() + '\'';
    }

    let query = scanClient.query(sql, function(err, result) {

      async.each(result.rows, (dbRow, next) => {

          let scanTablesClient = new pg.Client(connectionString + '/' + dbRow.datname);
          let dbName = dbRow.datname;

          scanTablesClient.connect(function(err) {
            if (err) {
              return next();
            }

            let query = scanTablesClient.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema='${postgresUtil.schema()}';
          `, function(err, result) {
              if (err) {
                return util.die('DB error at `scanning tables`');
              }

              _.each(result.rows, table => {
                let parts = table.table_name.split('_');
                let first = parts.shift();
                let exchangeName = dbName;

                /**
                 * If using single database, we need to strip
                 * exchange from table name. See here how tables
                 * are named:
                 *
                 * - in single database setup: poloniex_candles_usdt_btc
                 * - in multi db setup: db = poloniex, table = candles_usdt_btc
                 */
                if (postgresUtil.useSingleDatabase()) {
                  exchangeName = first;
                  first = parts.shift();
                }

                if (first === 'candles')
                  markets.push({
                    exchange: exchangeName,
                    currency: _.first(parts),
                    asset: _.last(parts),
                  });
              });

              scanTablesClient.end();

              next();
            });
          });

        },
        // got all tables!
        err => {
          scanClient.end();
          done(err, markets);
        });

    });
  });
};
