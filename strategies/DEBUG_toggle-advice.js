let settings = {
  wait: 0,
  each: 6
};

// -------

let _ = require('lodash');
let log = require('../core/log.js');

let i = 0;

let method = {
  init: _.noop,
  update: _.noop,
  log: _.noop,
  processTrade: function(trade) {
    log.debug('TRADE RECEIVED BY processTrade:', trade);
  },
  check: function(candle) {

    if(settings.wait > i)
      return;

    log.info('iteration:', i);

    if(i % settings.each === 0) {
      log.debug('trigger SHORT');
      this.advice('short');
    } else if(i % settings.each === settings.each / 2) {
      log.debug('trigger LONG');
      this.advice('long');
    }

    // if(i % 2 === 0)
    //   this.advice('long');
    // else if(i % 2 === 1)
    //   this.advice('short');

    i++;

  }
};

module.exports = method;
