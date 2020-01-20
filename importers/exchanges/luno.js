let moment = require('moment');
let util = require('../../core/util.js');
let _ = require('lodash');
let retry = require('../../exchange/exchangeUtils').retry;

let config = util.getConfig();
let dirs = util.dirs();
let Fetcher = require(dirs.exchanges + 'luno');

util.makeEventEmitter(Fetcher);

let end = false;
let from = false;
let REQUEST_INTERVAL = 5 * 1000;

Fetcher.prototype.getTrades = function(since, callback, descending) {
  let recoverableErrors = [
    'SOCKETTIMEDOUT',
    'TIMEDOUT',
    'CONNRESET',
    'CONNREFUSED',
    'NOTFOUND'
  ];

  let processResponse = function(funcName, callback) {
    return (error, body) => {
      if (!error && !body) {
        error = new Error('Empty response');
      }

      if (error) {
        console.log(funcName, 'processResponse received ERROR:', error.message);
        if (includes(error.message, recoverableErrors)) {
          error.notFatal = true;
        }

        if (includes(error.message, ['error 429'])) {
          error.notFatal = true;
          error.backoffDelay = 10000;
        }

        return callback(error, undefined);
      }

      return callback(undefined, body);
    }
  };

  let process = (err, result) => {
    if (err) {
      console.log('Error importing trades:', err);
      return;
    }
    let trades = _.map(result.trades, function(t) {
      return {
        price: t.price,
        date: Math.round(t.timestamp / 1000),
        amount: t.volume,
        tid: t.timestamp,
      };
    });
    callback(null, trades.reverse());
  };

  if (moment.isMoment(since)) since = since.valueOf();
  (_.isNumber(since) && since > 0) ? since: since = 0;

  console.log('importer getting trades from Luno since', moment.utc(since).format('YYYY-MM-DD HH:mm:ss'), 'UTC');

  let handler = cb => this.luno.getTrades({ since: since, pair: this.pair }, processResponse('getTrades', cb));
  retry(null, handler, process);
};

let fetcher = new Fetcher(config.watch);

let fetch = () => {
  fetcher.import = true;
  setTimeout(() => fetcher.getTrades(from, handleFetch), REQUEST_INTERVAL);
};

let handleFetch = (err, trades) => {
  if (err) {
    console.log(`There was an error importing from Luno: ${err}`);
    fetcher.emit('done');
    return fetcher.emit('trades', []);
  }

  if (trades.length > 0) {
    from = moment.utc(_.last(trades).tid + 1).clone();
  } else {
    fetcher.emit('done');
  }

  if (from >= end) {
    fetcher.emit('done');
    let endUnix = end.unix();
    trades = _.filter(trades, t => t.date <= endUnix);
  }

  fetcher.emit('trades', trades);
};

module.exports = function(daterange) {
  from = daterange.from.clone().utc();
  end = daterange.to.clone().utc();

  return {
    bus: fetcher,
    fetch: fetch,
  };
};
