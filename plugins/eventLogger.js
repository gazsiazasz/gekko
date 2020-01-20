let log = require('../core/log');
let _ = require('lodash');
let subscriptions = require('../subscriptions');
let config = require('../core/util').getConfig().eventLogger;

let EventLogger = function() {
};

_.each(subscriptions, sub => {
  if (config.whitelist && !config.whitelist.includes(sub.event)) {
    return;
  }

  EventLogger.prototype[sub.handler] = (event, next) => {
    log.info(`\t\t\t\t[EVENT ${sub.event}]\n`, event);
    if (_.isFunction(next))
      next();
  };
});

module.exports = EventLogger;
