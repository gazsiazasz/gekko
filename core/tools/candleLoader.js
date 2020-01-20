// TODO: properly handle a daterange for which no data is available.

let batchSize = 1000;

let _ = require('lodash');
let fs = require('fs');
let moment = require('moment');

let util = require('../../core/util');
let config = util.getConfig();
let dirs = util.dirs();
let log = require(dirs.core + '/log');

let adapter = config[config.adapter];
let Reader = require(dirs.gekko + adapter.path + '/reader');
let daterange = config.daterange;

let CandleBatcher = require(dirs.core + 'candleBatcher');

let to = moment.utc(daterange.to).startOf('minute');
let from = moment.utc(daterange.from).startOf('minute');
let toUnix = to.unix();

if(to <= from)
  util.die('This daterange does not make sense.');

if(!from.isValid())
  util.die('invalid `from`');

if(!to.isValid())
  util.die('invalid `to`');

let iterator = {
  from: from.clone(),
  to: from.clone().add(batchSize, 'm').subtract(1, 's')
};

let DONE = false;

let result = [];
let reader = new Reader();
let batcher;
let next;
let doneFn = () => {
  process.nextTick(() => {
    next(result);
  })
};

module.exports = function(candleSize, _next) {
  next = _.once(_next);

  batcher = new CandleBatcher(candleSize)
    .on('candle', handleBatchedCandles);

  getBatch();
};

let getBatch = () => {
  reader.get(
    iterator.from.unix(),
    iterator.to.unix(),
    'full',
    handleCandles
  )
};

let shiftIterator = () => {
  iterator = {
    from: iterator.from.clone().add(batchSize, 'm'),
    to: iterator.from.clone().add(batchSize * 2, 'm').subtract(1, 's')
  }
};

let handleCandles = (err, data) => {
  if(err) {
    console.error(err);
    util.die('Encountered an error..')
  }

  if(_.size(data) && _.last(data).start >= toUnix || iterator.from.unix() >= toUnix)
    DONE = true;

  batcher.write(data);
  batcher.flush();

  if(DONE) {
    reader.close();

    setTimeout(doneFn, 100);

  } else {
    shiftIterator();
    getBatch();
  }
};

let handleBatchedCandles = candle => {
  result.push(candle);
};
