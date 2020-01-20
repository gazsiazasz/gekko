let WebClient = require('@slack/client').WebClient;
let _ = require('lodash');
let log = require('../core/log.js');
let util = require('../core/util.js');
let config = util.getConfig();
let slackConfig = config.slack;

let Slack = function(done) {
  _.bindAll(this);

  this.slack;
  this.price = 'N/A';

  this.done = done;
  this.setup();
};

Slack.prototype.setup = function(done) {
  this.slack = new WebClient(slackConfig.token);

  let setupSlack = function(error, result) {
    if (slackConfig.sendMessageOnStart) {
      let body = this.createResponse('#439FE0', 'Gekko started!');
      this.send(body);
    } else {
      log.debug('Skipping Send message on startup');
    }
  };
  setupSlack.call(this);
};

Slack.prototype.processCandle = function(candle, done) {
  this.price = candle.close;

  done();
};

Slack.prototype.processAdvice = function(advice) {
  if (advice.recommendation === 'soft' && slackConfig.muteSoft) return;

  let color = advice.recommendation === 'long' ? 'good' : (advice.recommendation === 'short' ? 'danger' : 'warning');
  let body = this.createResponse(color, 'There is a new trend! The advice is to go `' + advice.recommendation + '`! Current price is `' + this.price + '`');

  this.send(body);
};

Slack.prototype.processStratNotification = function({ content }) {
  let body = this.createResponse('#909399', content);
  this.send(body);
};

Slack.prototype.send = function(content, done) {
  this.slack.chat.postMessage(slackConfig.channel, '', content, (error, response) => {
    if (error || !response) {
      log.error('Slack ERROR:', error);
    } else {
      log.info('Slack Message Sent');
    }
  });
};

Slack.prototype.checkResults = function(error) {
  if (error) {
    log.warn('error sending slack', error);
  } else {
    log.info('Send advice via slack.');
  }
};

Slack.prototype.createResponse = function(color, message) {
  return {
    'username': this.createUserName(),
    'icon_url': this.createIconUrl(),
    'attachments': [
      {
        'fallback': '',
        'color': color,
        'text': message,
        'mrkdwn_in': ['text'],
      },
    ],
  };
};

Slack.prototype.createUserName = function() {
  return config.watch.exchange[0].toUpperCase() + config.watch.exchange.slice(1) + ' - ' + config.watch.currency + '/' + config.watch.asset;
};

Slack.prototype.createIconUrl = function() {
  let asset = config.watch.asset === 'XBT' ? 'btc' : config.watch.asset.toLowerCase();
  return 'https://github.com/cjdowner/cryptocurrency-icons/raw/master/128/icon/' + asset + '.png';
};

module.exports = Slack;
