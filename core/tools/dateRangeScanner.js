let BATCH_SIZE = 60; // minutes
let MISSING_CANDLES_ALLOWED = 3; // minutes, per batch

let _ = require('lodash');
let moment = require('moment');
let async = require('async');

let util = require('../util');
let config = util.getConfig();
let dirs = util.dirs();
let log = require(dirs.core + 'log');

let adapter = config[config.adapter];
let Reader = require(dirs.gekko + adapter.path + '/reader');

let reader = new Reader();

// todo: rewrite with generators or async/await..
let scan = function(done) {
  log.info('Scanning local history for backtestable dateranges.');

  reader.tableExists('candles', (err, exists) => {

    if(err)
      return done(err, null, reader);

    if(!exists)
      return done(null, [], reader);

    async.parallel({
      boundry: reader.getBoundry,
      available: reader.countTotal
    }, (err, res) => {

      let first = res.boundry.first;
      let last = res.boundry.last;

      let optimal = (last - first) / 60;

      log.debug('Available', res.available);
      log.debug('Optimal', optimal);

      // There is a candle for every minute
      if(res.available === optimal + 1) {
        log.info('Gekko is able to fully use the local history.');
        return done(false, [{
          from: first,
          to: last
        }], reader);
      }

      // figure out where the gaps are..

      let missing = optimal - res.available + 1;

      log.info(`The database has ${missing} candles missing, Figuring out which ones...`);

      let iterator = {
        from: last - (BATCH_SIZE * 60),
        to: last
      };

      let batches = [];

      // loop through all candles we have
      // in batches and track whether they
      // are complete
      async.whilst(
          () => {
            return iterator.from > first
          },
          next => {
            let from = iterator.from;
            let to = iterator.to;
            reader.count(
              from,
              iterator.to,
              (err, count) => {
                let complete = count + MISSING_CANDLES_ALLOWED > BATCH_SIZE;

                if(complete)
                  batches.push({
                    to: to,
                    from: from
                  });

                next();
              }
            );

            iterator.from -= BATCH_SIZE * 60;
            iterator.to -= BATCH_SIZE * 60;
          },
          () => {
            if(batches.length === 0) {
              return done(null, [], reader);
            }

            // batches is now a list like
            // [ {from: unix, to: unix } ]

            let ranges = [ batches.shift() ];

            _.each(batches, batch => {
              let curRange = _.last(ranges);
              if(batch.to === curRange.from)
                curRange.from = batch.from;
              else
                ranges.push( batch );
            });

            // we have been counting chronologically reversed
            // (backwards, from now into the past), flip definitions
            ranges = ranges.reverse();

            _.map(ranges, r => {
              return {
                from: r.to,
                to: r.from
              }
            });


            // ranges is now a list like
            // [ {from: unix, to: unix } ]
            //
            // it contains all valid dataranges available for the
            // end user.

            return done(false, ranges, reader);
          }
        )
    });

  });
};

module.exports = scan;
