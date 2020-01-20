let _ = require('lodash');
let fs = require('co-fs');

let gekkoRoot = __dirname + '/../../';
let util = require(__dirname + '/../../core/util');

let config = {};

config.debug = false;
config.silent = false;

util.setConfig(config);

module.exports = function *() {
  let exchangesDir = yield fs.readdir(gekkoRoot + 'exchange/wrappers/');
  let exchanges = exchangesDir
    .filter(f => _.last(f, 3).join('') === '.js')
    .map(f => f.slice(0, -3));

  let allCapabilities = [];

  exchanges.forEach(function (exchange) {
    let Trader = null;

    try {
      Trader = require(gekkoRoot + 'exchange/wrappers/' + exchange);
    } catch (e) {
      return;
    }

    if (!Trader || !Trader.getCapabilities) {
      return;
    }

    allCapabilities.push(Trader.getCapabilities());
  });

  this.body = allCapabilities;
};
