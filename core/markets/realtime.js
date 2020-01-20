let _ = require('lodash');

let util = require('../util');
let dirs = util.dirs();

let exchangeChecker = require(dirs.gekko + 'exchange/exchangeChecker');
let config = util.getConfig();

let slug = config.watch.exchange.toLowerCase();
let exchange = exchangeChecker.getExchangeCapabilities(slug);

if (!exchange)
  util.die(`Unsupported exchange: ${slug}`);

let error = exchangeChecker.cantMonitor(config.watch);
if (error)
  util.die(error, true);

module.exports = require(dirs.budfox + 'budfox');
