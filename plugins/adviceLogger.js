let log = require('../core/log');
let moment = require('moment');
let _ = require('lodash');
let util = require('../core/util.js');
let config = util.getConfig();
let adviceLoggerConfig = config.adviceLogger;

let Actor = function() {
  this.price = 'N/A';
  this.marketTime = {
    format: function() {
      return 'N/A';
    },
  };
  _.bindAll(this);
};

Actor.prototype.processCandle = function(candle, done) {
  this.price = candle.close;
  this.marketTime = candle.start;

  done();
};

Actor.prototype.processAdvice = function(advice) {
  if (adviceLoggerConfig.muteSoft && advice.recommendation === 'soft') return;
  console.log();
  log.info('We have new trading advice!');
  log.info('\t Position:', advice.recommendation);
  log.info('\t Market price:', this.price);
  log.info('\t Based on market time:', this.marketTime.format('YYYY-MM-DD HH:mm:ss'));
  console.log();
};

Actor.prototype.finalize = function(advice, done) {
  // todo
  done();
};

module.exports = Actor;
