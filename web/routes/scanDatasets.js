let _ = require('lodash');
let promisify = require('promisify-node');

let scan = promisify(require('../../core/workers/datasetScan/parent'));

// starts a scan
// requires a post body with configuration of:
//
// - config.watch
let route = function* () {

  let config = require('./baseConfig');

  _.merge(config, this.request.body);

  this.body = yield scan(config);
};

module.exports = route;
