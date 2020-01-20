// simple POST request that returns the backtest result

let _ = require('lodash');
let promisify = require('tiny-promisify');
let pipelineRunner = promisify(require('../../core/workers/pipeline/parent'));

// starts a backtest
// requires a post body like:
//
// {
//   gekkoConfig: {watch: {exchange: "poloniex", currency: "USDT", asset: "BTC"},…},…}
//   data: {
//     candleProps: ["close", "start"],
//     indicatorResults: true,
//     report: true,
//     roundtrips: true
//   }
// }
module.exports = function *() {
  let mode = 'backtest';

  let config = {};

  let base = require('./baseConfig');

  let req = this.request.body;

  _.merge(config, base, req);

  this.body = yield pipelineRunner(mode, config);
};
