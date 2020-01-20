let _ = require('lodash');
let moment = require('moment');
let async = require('async');
let os = require('os');

let util = require('../../util');
let dirs = util.dirs();

let dateRangeScan = require('../dateRangeScan/parent');

module.exports = function(config, done) {

  util.setConfig(config);

  let adapter = config[config.adapter];
  let scan = require(dirs.gekko + adapter.path + '/scanner');

  scan((err, markets) => {

    if (err)
      return done(err);

    let numCPUCores = os.cpus().length;
    if (numCPUCores === undefined)
      numCPUCores = 1;
    async.eachLimit(markets, numCPUCores, (market, next) => {

      let marketConfig = _.clone(config);
      marketConfig.watch = market;

      dateRangeScan(marketConfig, (err, ranges) => {
        if (err)
          return next();

        market.ranges = ranges;

        next();
      });

    }, err => {
      let resp = {
        datasets: [],
        errors: [],
      };
      markets.forEach(market => {
        if (market.ranges)
          resp.datasets.push(market);
        else
          resp.errors.push(market);
      });
      done(err, resp);
    });
  });
};
