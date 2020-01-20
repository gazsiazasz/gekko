// helpers
let _ = require('lodash');
let log = require('../core/log');

// configuration
let config = require('../core/util').getConfig();
let settings = config.varPPO;
let momentum = settings.momentum;
let momentumName = momentum.toLowerCase();
let momentumSettings = config[momentum];

// let's create our own method
let method = {};

// prepare everything our method needs
method.init = function() {
  this.trend = {
   direction: 'none',
   duration: 0,
   persisted: false,
   adviced: false
  };

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('ppo', 'PPO', config.PPO);
  this.addIndicator(momentumName, momentum, momentumSettings);
};

// what happens on every new candle?
method.update = function(candle) {
  // nothing!
};

// for debugging purposes log the last
// calculated parameters.
method.log = function(candle) {
  let digits = 8;
  let ppo = this.indicators.ppo.result;
  let result = ppo.ppo;
  let signal = ppo.PPOsignal;
  let hist = ppo.PPOhist;
  let momentumResult = this.indicators[momentumName][momentumName];

  log.debug('\t', 'PPO:', result.toFixed(digits));
  log.debug('\t', 'PPOsignal:', signal.toFixed(digits));
  log.debug('\t', 'PPOhist:', hist.toFixed(digits));
  log.debug('\t', momentum + ':', momentumResult.toFixed(digits));
  log.debug('\t', 'price:', candle.close.toFixed(digits));
};

method.check = function() {
  let ppo = this.indicators.ppo.result;
  let hist = ppo.PPOhist;

  let value = this.indicators[momentumName][momentumName];

  let thresholds = {
    low: momentumSettings.thresholds.low + hist * settings.thresholds.weightLow,
    high: momentumSettings.thresholds.high + hist * settings.thresholds.weightHigh
  };

  if(value < thresholds.low) {

    // new trend detected
    if(this.trend.direction !== 'up')
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'up',
        adviced: false
      };

    this.trend.duration++;

    log.debug('In uptrend since', this.trend.duration, 'candle(s)');

    if(this.trend.duration >= settings.thresholds.persistence)
      this.trend.persisted = true;

    if(this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.advice('long');
    } else
      this.advice();

  } else if(value > thresholds.high) {

    // new trend detected
    if(this.trend.direction !== 'down')
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'down',
        adviced: false
      };

    this.trend.duration++;

    log.debug('In downtrend since', this.trend.duration, 'candle(s)');

    if(this.trend.duration >= settings.thresholds.persistence)
      this.trend.persisted = true;

    if(this.trend.persisted && !this.trend.adviced) {
      this.trend.adviced = true;
      this.advice('short');
    } else
      this.advice();


  } else {

    log.debug('In no trend');

    // we're not in an up nor in a downtrend
    // but for now we ignore sideways trends
    //
    // read more @link:
    //
    // https://github.com/askmike/gekko/issues/171

    // this.trend = {
    //   direction: 'none',
    //   duration: 0,
    //   persisted: false,
    //   adviced: false
    // };

    this.advice();
  }

};

module.exports = method;
