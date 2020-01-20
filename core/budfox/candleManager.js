// The candleManager consumes trades and emits:
// - `candles`: array of minutly candles.
// - `candle`: the most recent candle after a fetch Gekko.

let _ = require('lodash');
let moment = require('moment');
let fs = require('fs');

let util = require(__dirname + '/../util');
let dirs = util.dirs();
let config = util.getConfig();
let log = require(dirs.core + 'log');

let CandleCreator = require(dirs.budfox + 'candleCreator');

let Manager = function() {
  _.bindAll(this);

  this.candleCreator = new CandleCreator;

  this.candleCreator.on('candles', this.relayCandles);
};

util.makeEventEmitter(Manager);
Manager.prototype.processTrades = function(tradeBatch) {
  this.candleCreator.write(tradeBatch);
};

Manager.prototype.relayCandles = function(candles) {
  this.emit('candles', candles);
};

module.exports = Manager;
