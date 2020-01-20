let _ = require('lodash');
let log = require('../core/log.js');
let util = require('../core/util.js');
let config = util.getConfig();
let twitterConfig = config.twitter;
let TwitterApi = require('twitter');

require('dotenv').config();

let Twitter = function(done) {
    _.bindAll(this);

    this.twitter;
    this.price = 'N/A';
    this.done = done;
    this.setup();

};

Twitter.prototype.setup = function(done){
    let setupTwitter = function (err, result) {
        this.client = new TwitterApi({
          consumer_key: twitterConfig.consumer_key,
          consumer_secret: twitterConfig.consumer_secret,
          access_token_key: twitterConfig.access_token_key,
          access_token_secret: twitterConfig.access_token_secret
        });

        if(twitterConfig.sendMessageOnStart){
            let exchange = config.watch.exchange;
            let currency = config.watch.currency;
            let asset = config.watch.asset;
            let body = "Watching "
                +exchange
                +" "
                +currency
                +" "
                +asset;
            this.mail(body);
        }else{
            log.debug('Skipping Send message on startup')
        }
    };
    setupTwitter.call(this)
};

Twitter.prototype.processCandle = function(candle, done) {
    this.price = candle.close;

    done();
};

Twitter.prototype.processAdvice = function(advice) {
	if (advice.recommendation === "soft" && twitterConfig.muteSoft) return;
	let text = [
        'New  ', config.watch.asset, ' trend. Attempting to ',
        advice.recommendation === "short" ? "sell" : "buy",
        ' @',
        this.price,
    ].join('');

    this.mail(text);
};

Twitter.prototype.mail = function(content, done) {
    log.info("trying to tweet");
    this.client.post('statuses/update', {status: content},  function(error, tweet, response) {
      if(error || !response) {
          log.error('Twitter ERROR:', error)
      } else if(response && response.active){
          log.info('Twitter Message Sent')
      }
    });
};

Twitter.prototype.checkResults = function(err) {
    if(err)
        log.warn('error sending email', err);
    else
        log.info('Send advice via email.');
};


module.exports = Twitter;
