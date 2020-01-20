let _ = require('lodash');
let fs = require('co-fs');

let parts = {
  paperTrader: 'config/plugins/paperTrader',
  candleWriter: 'config/plugins/candleWriter',
  performanceAnalyzer: 'config/plugins/performanceAnalyzer'
};

let gekkoRoot = __dirname + '/../../';

module.exports = function *() {
  if(!_.has(parts, this.params.part))
    return this.body = 'error :(';

  let fileName = gekkoRoot + '/' + parts[this.params.part] + '.toml';
  this.body = {
    part: yield fs.readFile(fileName, 'utf8')
  }
};
