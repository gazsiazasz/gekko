// a leech market is "semi-realtime" and pulls out candles of a
// database (which is expected to be updated regularly, like with a
// realtime market running in parallel).

let _ = require('lodash');
let moment = require('moment');

let util = require('../util');
let dirs = util.dirs();
let config = util.getConfig();

let exchangeChecker = require(dirs.gekko + 'exchange/exchangeChecker');

let adapter = config[config.adapter];
let Reader = require(dirs.gekko + adapter.path + '/reader');

let TICKINTERVAL = 20 * 1000; // 20 seconds

let slug = config.watch.exchange.toLowerCase();
let exchange = exchangeChecker.getExchangeCapabilities(slug);

if (!exchange)
  util.die(`Unsupported exchange: ${slug}`);

let error = exchangeChecker.cantMonitor(config.watch);
if (error)
  util.die(error, true);

if (config.market.from)
  var fromTs = moment.utc(config.market.from).unix();
else
  var fromTs = moment().startOf('minute').unix();


let Market = function() {

  _.bindAll(this);

  Readable.call(this, { objectMode: true });

  this.reader = new Reader();
  this.latestTs = fromTs;

  setInterval(
    this.get,
    TICKINTERVAL,
  );
};

let Readable = require('stream').Readable;
Market.prototype = Object.create(Readable.prototype, {
  constructor: { value: Market },
});

Market.prototype._read = _.once(function() {
  this.get();
});

Market.prototype.get = function() {
  let future = moment().add(1, 'minute').unix();

  this.reader.get(
    this.latestTs,
    future,
    'full',
    this.processCandles,
  );
};

Market.prototype.processCandles = function(err, candles) {
  let amount = _.size(candles);
  if (amount === 0) {
    // no new candles!
    return;
  }

  // TODO:
  // verify that the correct amount of candles was passed:
  //
  // if `this.latestTs` was at 10:00 and we receive 3 candles with the latest at 11:00
  // we know we are missing 57 candles...

  _.each(candles, function(c, i) {
    c.start = moment.unix(c.start).utc();
    this.push(c);
  }, this);

  this.latestTs = _.last(candles).start.unix() + 1;
};

module.exports = Market;
