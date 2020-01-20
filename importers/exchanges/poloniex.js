let util = require('../../core/util.js');
let _ = require('lodash');
let moment = require('moment');
let log = require('../../core/log');
let retry = require('../../exchange/exchangeUtils').retry;

let config = util.getConfig();

let dirs = util.dirs();

let Fetcher = require(dirs.exchanges + 'poloniex');

let batchSize = 60 * 2; // 2 hour
let overlapSize = 10; // 10 minutes

// Helper methods
function joinCurrencies(currencyA, currencyB) {
  return currencyA + '_' + currencyB;
}

// patch getTrades..
Fetcher.prototype.getTrades = function(range, callback) {
  let handle = (err, result) => {
    if (err) {
      return callback(err);
    }

    if (_.size(result) === 50000) {
      // to many trades..
      util.die('too many trades..');
    }

    result = _.map(result, function(trade) {
      return {
        tid: trade.tradeID,
        amount: +trade.amount,
        date: moment.utc(trade.date).format('X'),
        price: +trade.rate,
      };
    });

    callback(result.reverse());
  };

  let params = {
    currencyPair: joinCurrencies(this.currency, this.asset),
  };

  params.start = range.from.unix();
  params.end = range.to.unix();

  let fetch = next => this.poloniex._public('returnTradeHistory', params, this.processResponse(next));
  retry(null, fetch, handle);
};

util.makeEventEmitter(Fetcher);

let iterator = false;
let end = false;
let done = false;

let fetcher = new Fetcher(config.watch);

let fetch = () => {
  log.info(
    config.watch.currency,
    config.watch.asset,
    'Requesting data from',
    iterator.from.format('YYYY-MM-DD HH:mm:ss') + ',',
    'to',
    iterator.to.format('YYYY-MM-DD HH:mm:ss'),
  );

  if (util.gekkoEnv === 'child-process') {
    let msg = ['Requesting data from',
      iterator.from.format('YYYY-MM-DD HH:mm:ss') + ',',
      'to',
      iterator.to.format('YYYY-MM-DD HH:mm:ss')].join('');
    process.send({ type: 'log', log: msg });
  }
  fetcher.getTrades(iterator, handleFetch);
};

let handleFetch = trades => {
  iterator.from.add(batchSize, 'minutes').subtract(overlapSize, 'minutes');
  iterator.to.add(batchSize, 'minutes').subtract(overlapSize, 'minutes');

  if (!_.size(trades)) {
    // fix https://github.com/askmike/gekko/issues/952
    if (iterator.to.clone().add(batchSize * 4, 'minutes') > end) {
      fetcher.emit('done');
    }

    return fetcher.emit('trades', []);
  }

  let last = moment.unix(_.last(trades).date);

  if (last > end) {
    fetcher.emit('done');

    let endUnix = end.unix();
    trades = _.filter(
      trades,
      t => t.date <= endUnix,
    );
  }

  fetcher.emit('trades', trades);
};

module.exports = function(daterange) {
  iterator = {
    from: daterange.from.clone(),
    to: daterange.from.clone().add(batchSize, 'minutes'),
  };
  end = daterange.to.clone();

  return {
    bus: fetcher,
    fetch: fetch,
  };
};
