let ForkTask = require('relieve').tasks.ForkTask;
let fork = require('child_process').fork;

module.exports = function(config, done) {
  let debug = typeof v8debug === 'object';
  if (debug) {
    process.execArgv = [];
  }

  let task = new ForkTask(fork(__dirname + '/child'));

  task.send('start', config);

  task.once('ranges', ranges => {
    return done(false, ranges);
  });
  task.on('exit', code => {
    if(code !== 0)
      done('ERROR, unable to scan dateranges, please check the console.');
  });
};
