let fs = require('fs');
let _ = require('lodash');
let cache = require('./state/cache');
let broadcast = cache.get('broadcast');

let apiKeysFile = __dirname + '/../SECRET-api-keys.json';

// on init:
let noApiKeysFile = !fs.existsSync(apiKeysFile);

if (noApiKeysFile)
  fs.writeFileSync(
    apiKeysFile,
    JSON.stringify({}),
  );

let apiKeys = JSON.parse(fs.readFileSync(apiKeysFile, 'utf8'));

module.exports = {
  get: () => _.keys(apiKeys),

  // note: overwrites if exists
  add: (exchange, props) => {
    apiKeys[exchange] = props;
    fs.writeFileSync(apiKeysFile, JSON.stringify(apiKeys));

    broadcast({
      type: 'apiKeys',
      exchanges: _.keys(apiKeys),
    });
  },
  remove: exchange => {
    if (!apiKeys[exchange])
      return;

    delete apiKeys[exchange];
    fs.writeFileSync(apiKeysFile, JSON.stringify(apiKeys));

    broadcast({
      type: 'apiKeys',
      exchanges: _.keys(apiKeys),
    });
  },

  // retrieve api keys
  // this cannot touch the frontend for security reaons.
  _getApiKeyPair: key => apiKeys[key],
};
