let push = require('pushover-notifications');
let _ = require('lodash');
let log = require('../core/log.js');
let util = require('../core/util.js');
let config = util.getConfig();
let pushoverConfig = config.pushover;

let Pushover = function() {
  _.bindAll(this);

  this.p;
  this.price = 'N/A';

  this.setup();
};

Pushover.prototype.setup = function() {
  let setupPushover = function() {
    this.p = new push({
      user: pushoverConfig.user,
      token: pushoverConfig.key,
    });

    if (pushoverConfig.sendPushoverOnStart) {
      this.send(
        'Gekko has started',
        [
          'I\'ve just started watching ',
          config.watch.exchange,
          ' ',
          config.watch.currency,
          '/',
          config.watch.asset,
          '. I\'ll let you know when I got some advice',
        ].join(''),
      );
    } else
      log.debug('Setup pushover adviser.');
  };
  setupPushover.call(this);
};

Pushover.prototype.send = function(subject, content) {
  let msg = {
    // These values correspond to the parameters detailed on https://pushover.net/api
    // 'message' is required. All other values are optional.
    message: content,
    title: pushoverConfig.tag + subject,
    device: 'devicename',
    priority: 1,
  };

  this.p.send(msg, function(err, result) {
    if (err) {
      throw err;
    }

    console.log(result);
  });

};

Pushover.prototype.processCandle = function(candle, callback) {
  this.price = candle.close;
  callback();
};

Pushover.prototype.processAdvice = function(advice) {
  if (advice.recommendation === 'soft' && pushoverConfig.muteSoft) return;
  let text = [
    advice.recommendation,
    this.price,
  ].join(' ');
  let subject = text;
  this.send(subject, text);
};

Pushover.prototype.checkResults = function(err) {
  if (err)
    log.warn('error sending pushover', err);
  else
    log.info('Send advice via pushover.');
};

module.exports = Pushover;
