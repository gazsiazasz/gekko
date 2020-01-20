let _ = require('lodash');
let fs = require('fs');
let util = require('../../core/util');
let config = util.getConfig();
let dirs = util.dirs();
let log = require(dirs.core + 'log');

let talib = require(dirs.core + 'talib');
let tulind = require(dirs.core + 'tulind');

let allowedTalibIndicators = _.keys(talib);
let allowedTulipIndicators = _.keys(tulind);

let AsyncIndicatorRunner = function() {
  this.talibIndicators = {};
  this.tulipIndicators = {};

  this.candleProps = {
    open: [],
    high: [],
    low: [],
    close: [],
    volume: [],
  };

  this.candlePropsCacheSize = 1000;

  this.inflight = false;
  this.backlog = [];
  this.age = 0;
};

AsyncIndicatorRunner.prototype.processCandle = function(candle, next) {
  if (this.inflight) {
    return this.backlog.push({ candle, next });
  }

  this.age++;
  this.inflight = true;

  this.candleProps.open.push(candle.open);
  this.candleProps.high.push(candle.high);
  this.candleProps.low.push(candle.low);
  this.candleProps.close.push(candle.close);
  this.candleProps.volume.push(candle.volume);

  if (this.age > this.candlePropsCacheSize) {
    this.candleProps.open.shift();
    this.candleProps.high.shift();
    this.candleProps.low.shift();
    this.candleProps.close.shift();
    this.candleProps.volume.shift();
  }

  this.calculateIndicators(next);
};

AsyncIndicatorRunner.prototype.calculateIndicators = function(next) {
  let done = _.after(
    _.size(this.talibIndicators) + _.size(this.tulipIndicators),
    this.handlePostFlight(next),
  );

  // handle result from talib
  let talibResultHander = name => (err, result) => {
    if (err)
      util.die('TALIB ERROR:', err);

    this.talibIndicators[name].result = _.mapValues(result, v => _.last(v));
    done();
  };

  // handle result from talib
  _.each(
    this.talibIndicators,
    (indicator, name) => indicator.run(
      this.candleProps,
      talibResultHander(name),
    ),
  );

  // handle result from tulip
  let tulindResultHander = name => (err, result) => {
    if (err)
      util.die('TULIP ERROR:', err);

    this.tulipIndicators[name].result = _.mapValues(result, v => _.last(v));
    done();
  };

  // handle result from tulip indicators
  _.each(
    this.tulipIndicators,
    (indicator, name) => indicator.run(
      this.candleProps,
      tulindResultHander(name),
    ),
  );
};

AsyncIndicatorRunner.prototype.handlePostFlight = function(next) {
  return () => {
    next();
    this.inflight = false;

    if (this.backlog.length) {
      let { candle, next } = this.backlog.shift();
      this.processCandle(candle, next);
    }
  };
};

AsyncIndicatorRunner.prototype.addTalibIndicator = function(name, type, parameters) {
  if (!talib)
    util.die('Talib is not enabled');

  if (!_.contains(allowedTalibIndicators, type))
    util.die('I do not know the talib indicator ' + type);

  if (this.setup)
    util.die('Can only add talib indicators in the init method!');

  let basectx = this;

  this.talibIndicators[name] = {
    run: talib[type].create(parameters),
    result: NaN,
  };
};

AsyncIndicatorRunner.prototype.addTulipIndicator = function(name, type, parameters) {
  if (!tulind) {
    util.die('Tulip indicators is not enabled');
  }

  if (!_.contains(allowedTulipIndicators, type))
    util.die('I do not know the tulip indicator ' + type);

  if (this.setup)
    util.die('Can only add tulip indicators in the init method!');

  let basectx = this;

  this.tulipIndicators[name] = {
    run: tulind[type].create(parameters),
    result: NaN,
  };
};

module.exports = AsyncIndicatorRunner;
