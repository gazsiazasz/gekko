// helpers
let _ = require('lodash');
let log = require('../core/log.js');

let TSI = require('./indicators/TSI.js');

// let's create our own method
let method = {};

// prepare everything our method needs
method.init = function() {
  this.name = 'TSI';

  this.trend = {
    direction: 'none',
    duration: 0,
    persisted: false,
    adviced: false,
  };

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('tsi', 'TSI', this.settings);
};

// for debugging purposes log the last
// calculated parameters.
method.log = function(candle) {
  let digits = 8;
  let tsi = this.indicators.tsi;

  log.debug('calculated TSI properties for candle:');
  log.debug('\t', 'tsi:', tsi.tsi.toFixed(digits));
  log.debug('\t', 'price:', candle.close.toFixed(digits));
};

method.check = function() {
  let tsi = this.indicators.tsi;
  let tsiVal = tsi.tsi;

  if (tsiVal > this.settings.thresholds.high) {

    // new trend detected
    if (this.trend.direction !== 'high')
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'high',
        adviced: false,
      };

    this.trend.duration++;

    log.debug('In high since', this.trend.duration, 'candle(s)');

    if (this.trend.duration >= this.settings.thresholds.persistence)
      this.trend.persisted = true;

    if (this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.advice('short');
    } else
      this.advice();

  } else if (tsiVal < this.settings.thresholds.low) {

    // new trend detected
    if (this.trend.direction !== 'low')
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'low',
        adviced: false,
      };

    this.trend.duration++;

    log.debug('In low since', this.trend.duration, 'candle(s)');

    if (this.trend.duration >= this.settings.thresholds.persistence)
      this.trend.persisted = true;

    if (this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.advice('long');
    } else
      this.advice();

  } else {

    log.debug('In no trend');

    this.advice();
  }
};

module.exports = method;
