let _ = require('lodash');

let cache = require('../state/cache');
let Logger = require('../state/logger');
let apiKeyManager= cache.get('apiKeyManager');
let gekkoManager = cache.get('gekkos');

let base = require('./baseConfig');

// starts an import
// requires a post body with a config object
module.exports = function *() {
  let mode = this.request.body.mode;

  let config = {};

  _.merge(config, base, this.request.body);

  // Attach API keys
  if(config.trader && config.trader.enabled && !config.trader.key) {

    let keys = apiKeyManager._getApiKeyPair(config.watch.exchange);

    if(!keys) {
      this.body = 'No API keys found for this exchange.';
      return;
    }

    _.merge(
      config.trader,
      keys
    );
  }

  this.body = gekkoManager.add({ config, mode });
};
