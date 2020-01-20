let settings = {
  wait: 0,
  // advice: 'short'
  advice: 'long',
};

// -------

let _ = require('lodash');
let log = require('../core/log.js');

let i = 0;

let method = {
  init: _.noop,
  update: _.noop,
  log: _.noop,
  check: function() {

    // log.info('iteration:', i);
    if (settings.wait === i) {
      console.log('trigger advice!');
      this.advice({
        direction: settings.advice,
        trigger: {
          type: 'trailingStop',
          trailPercentage: 0.5,
        },
      });
    }

    i++;

  },
};

module.exports = method;
