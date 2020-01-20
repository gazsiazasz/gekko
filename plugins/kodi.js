/**
 * Created by billymcintosh on 24/12/17.
 */

let _ = require('lodash');
let request = require('request');
let log = require('../core/log.js');
let util = require('../core/util.js');
let config = util.getConfig();
let kodiConfig = config.kodi;

let Kodi = function(done) {
    _.bindAll(this);

    this.exchange = config.watch.exchange.charAt().toUpperCase() + config.watch.exchange.slice(1)

    this.price = 'N/A';
    this.done = done;
    this.setup();
};

Kodi.prototype.setup = function(done) {
    let setupKodi = function (err, result) {
        if(kodiConfig.sendMessageOnStart) {
            let currency = config.watch.currency;
            let asset = config.watch.asset;
            let title = "Gekko Started";
            let message = `Watching ${this.exchange} - ${currency}/${asset}`;
            this.mail(title, message);
        } else {
            log.debug('Skipping Send message on startup')
        }
    };
    setupKodi.call(this)
};

Kodi.prototype.processCandle = function(candle, done) {
    this.price = candle.close;

    done();
};

Kodi.prototype.processAdvice = function(advice) {
    let title = `Gekko: Going ${advice.recommendation} @ ${this.price}`;
    let message = `${this.exchange} ${config.watch.currency}/${config.watch.asset}`;
    this.mail(title, message);
};

Kodi.prototype.mail = function(title, message, done) {
    let options = {
      body: `{"jsonrpc":"2.0","method":"GUI.ShowNotification","params":{"title":"${title}","message":"${message}"},"id":1}`,
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
      url: kodiConfig.host
    };

    request(options, (error, response, body) => {
        if (!error) {
            log.info('Kodi message sent')
        } else {
            log.debug(`Kodi ${error}`)
        }
    })
};

module.exports = Kodi;
