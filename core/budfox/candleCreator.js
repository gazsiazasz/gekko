// The CandleCreator creates one minute candles based on trade batches. Note
// that it also adds empty candles to fill gaps with no volume.
//
// Expects trade batches to be written like:
//
// {
//   amount: x,
//   start: (moment),
//   end: (moment),
//   first: (trade),
//   last: (trade),
//   timespan: x,
//   all: [
//      // batch of new trades with
//      // moments instead of timestamps
//   ]
// }
//
// Emits 'new candles' event with:
//
// [
//     {
//       start: (moment),
//       end: (moment),
//       high: (float),
//       open: (float),
//       low: (float),
//       close: (float)
//       volume: (float)
//       vwp: (float) // volume weighted price
//    },
//    {
//       start: (moment), // + 1
//       end: (moment),
//       high: (float),
//       open: (float),
//      low: (float),
//      close: (float)
//       volume: (float)
//       vwp: (float) // volume weighted price
//    }
//    // etc.
// ]
//

let _ = require('lodash');
let moment = require('moment');

let util = require(__dirname + '/../util');

let CandleCreator = function() {
  _.bindAll(this);

  // TODO: remove fixed date
  this.threshold = moment("1970-01-01", "YYYY-MM-DD");

  // This also holds the leftover between fetches
  this.buckets = {};
};

util.makeEventEmitter(CandleCreator);

CandleCreator.prototype.write = function(batch) {
  let trades = batch.data;

  if(_.isEmpty(trades))
    return;

  trades = this.filter(trades);
  this.fillBuckets(trades);
  let candles = this.calculateCandles();

  candles = this.addEmptyCandles(candles);

  if(_.isEmpty(candles))
    return;

  // the last candle is not complete
  this.threshold = candles.pop().start;

  this.emit('candles', candles);
};

CandleCreator.prototype.filter = function(trades) {
  // make sure we only include trades more recent
  // than the previous emitted candle
  return _.filter(trades, function(trade) {
    return trade.date > this.threshold;
  }, this);
};

// put each trade in a per minute bucket
CandleCreator.prototype.fillBuckets = function(trades) {
  _.each(trades, function(trade) {
    let minute = trade.date.format('YYYY-MM-DD HH:mm');

    if(!(minute in this.buckets))
      this.buckets[minute] = [];

    this.buckets[minute].push(trade);
  }, this);

  this.lastTrade = _.last(trades);
};

// convert each bucket into a candle
CandleCreator.prototype.calculateCandles = function() {
  let minutes = _.size(this.buckets);

  // catch error from high volume getTrades
  if (this.lastTrade !== undefined)
    // create a string referencing the minute this trade happened in
    var lastMinute = this.lastTrade.date.format('YYYY-MM-DD HH:mm');

  return _.map(this.buckets, function(bucket, name) {
    let candle = this.calculateCandle(bucket);

    // clean all buckets, except the last one:
    // this candle is not complete
    if (name !== lastMinute)
      delete this.buckets[name];

    return candle;
  }, this);
};

CandleCreator.prototype.calculateCandle = function(trades) {
  let first = _.first(trades);

  let f = parseFloat;

  let candle = {
    start: first.date.clone().startOf('minute'),
    open: f(first.price),
    high: f(first.price),
    low: f(first.price),
    close: f(_.last(trades).price),
    vwp: 0,
    volume: 0,
    trades: _.size(trades)
  };

  _.each(trades, function(trade) {
    candle.high = _.max([candle.high, f(trade.price)]);
    candle.low = _.min([candle.low, f(trade.price)]);
    candle.volume += f(trade.amount);
    candle.vwp += f(trade.price) * f(trade.amount);
  });

  candle.vwp /= candle.volume;

  return candle;
};

// Gekko expects a candle every minute, if nothing happened
// during a particilar minute Gekko will add empty candles with:
//
// - open, high, close, low, vwp are the same as the close of the previous candle.
// - trades, volume are 0
CandleCreator.prototype.addEmptyCandles = function(candles) {
  let amount = _.size(candles);
  if(!amount)
    return candles;

  // iterator
  let start = _.first(candles).start.clone();
  let end = _.last(candles).start;
  let i, j = -1;

  let minutes = _.map(candles, function(candle) {
    return +candle.start;
  });

  while(start < end) {
    start.add(1, 'm');
    i = +start;
    j++;

    if(_.contains(minutes, i))
      continue; // we have a candle for this minute

    let lastPrice = candles[j].close;

    candles.splice(j + 1, 0, {
      start: start.clone(),
      open: lastPrice,
      high: lastPrice,
      low: lastPrice,
      close: lastPrice,
      vwp: lastPrice,
      volume: 0,
      trades: 0
    });
  }
  return candles;
};

module.exports = CandleCreator;
