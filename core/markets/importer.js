let _ = require('lodash');
let util = require('../util');
let config = util.getConfig();
let dirs = util.dirs();
let log = require(dirs.core + 'log');
let moment = require('moment');
let gekkoEnv = util.gekkoEnv();

let adapter = config[config.adapter];
let daterange = config.importer.daterange;

let from = moment.utc(daterange.from);

let to = (daterange.to) ? moment.utc(daterange.to) : moment().utc();
if(!daterange.to) {
  log.debug(
    'No end date specified for importing, setting to',
    to.format()
  );
}
log.debug(to.format());

if(!from.isValid())
  util.die('invalid `from`');

if(!to.isValid())
  util.die('invalid `to`');

let TradeBatcher = require(dirs.budfox + 'tradeBatcher');
let CandleManager = require(dirs.budfox + 'candleManager');
let exchangeChecker = require(dirs.gekko + 'exchange/exchangeChecker');

let error = exchangeChecker.cantFetchFullHistory(config.watch);
if(error)
  util.die(error, true);

let fetcher = require(dirs.importers + config.watch.exchange);

if(to <= from)
  util.die('This daterange does not make sense.');

let Market = function() {
  _.bindAll(this);
  this.exchangeSettings = exchangeChecker.settings(config.watch);

  this.tradeBatcher = new TradeBatcher(this.exchangeSettings.tid);
  this.candleManager = new CandleManager;
  this.fetcher = fetcher({
    to: to,
    from: from
  });

  this.done = false;

  this.fetcher.bus.on(
    'trades',
    this.processTrades
  );

  this.fetcher.bus.on(
    'done',
    function() {
      this.done = true;
    }.bind(this)
  );

  this.tradeBatcher.on(
    'new batch',
    this.candleManager.processTrades
  );

  this.candleManager.on(
    'candles',
    this.pushCandles
  );

  Readable.call(this, {objectMode: true});

  this.get();
};

let Readable = require('stream').Readable;
Market.prototype = Object.create(Readable.prototype, {
  constructor: { value: Market }
});

Market.prototype._read = _.noop;

Market.prototype.pushCandles = function(candles) {
  _.each(candles, this.push);
};

Market.prototype.get = function() {
  this.fetcher.fetch();
};

Market.prototype.processTrades = function(trades) {
  this.tradeBatcher.write(trades);

  if(this.done) {
    log.info('Done importing!');
    this.emit('end');
    return;
  }

  if(_.size(trades) && gekkoEnv === 'child-process') {
    let lastAtTS = _.last(trades).date;
    let lastAt = moment.unix(lastAtTS).utc().format();
    process.send({event: 'marketUpdate', payload: lastAt});
  }

  setTimeout(this.get, 1000);
};

module.exports = Market;
