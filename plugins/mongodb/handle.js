let mongojs = require('mongojs');
let mongoUtil = require('./util');

let util = require('../../core/util.js');
let config = util.getConfig();
let dirs = util.dirs();

// verify the correct dependencies are installed
let pluginHelper = require(`${dirs.core}pluginUtil`);
let pluginMock = {
  slug: 'mongodb adapter',
  dependencies: config.mongodb.dependencies
};

// exit if plugin couldn't be loaded
let cannotLoad = pluginHelper.cannotLoad(pluginMock);
if (cannotLoad) {
  util.die(cannotLoad);
}

let mode = util.gekkoMode();

let collections = [
  mongoUtil.settings.historyCollection,
  mongoUtil.settings.adviceCollection
];

let connection = mongojs(config.mongodb.connectionString, collections);
let collection = connection.collection(mongoUtil.settings.historyCollection);

if (mode === 'backtest') {
  let pair = mongoUtil.settings.pair.join('_');

  collection.find({ pair }).toArray((err, docs) => { // check if we've got any records
    if (err) {
      util.die(err);
    }
    if (docs.length === 0) {
      util.die(`History table for ${config.watch.exchange} with pair ${pair} is empty.`);
    }
  })
}

if(mongoUtil.settings.exchange) {
    collection.createIndex({start: 1, pair: 1}, {unique: true}); // create unique index on "time" and "pair"
}
module.exports = connection;
