let _ = require('lodash');
let fs = require('co-fs');

let gekkoRoot = __dirname + '/../../';

module.exports = function* () {
  let strategyDir = yield fs.readdir(gekkoRoot + 'strategies');
  let strats = strategyDir
    .filter(f => _.last(f, 3).join('') === '.js')
    .map(f => {
      return { name: f.slice(0, -3) };
    });

  // for every strat, check if there is a config file and add it
  let stratConfigPath = gekkoRoot + 'config/strategies';
  let strategyParamsDir = yield fs.readdir(stratConfigPath);

  for (let i = 0; i < strats.length; i++) {
    let strat = strats[i];
    if (strategyParamsDir.indexOf(strat.name + '.toml') !== -1)
      strat.params = yield fs.readFile(stratConfigPath + '/' + strat.name + '.toml', 'utf8');
    else
      strat.params = '';
  }

  this.body = strats;
};
