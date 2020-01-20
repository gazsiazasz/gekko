let chai = require('chai');
let expect = chai.expect;
let should = chai.should;
let assert = chai.assert;
let sinon = require('sinon');
let proxyquire = require('proxyquire');

let _ = require('lodash');
let moment = require('moment');

let util = require(__dirname + '/../core/util');
let config = util.getConfig();
let dirs = util.dirs();

let providerName = config.watch.exchange.toLowerCase();
let providerPath = util.dirs().gekko + 'exchanges/' + providerName;

return; // TEMP

let mf;

let spoofer = {};

let TRADES = [
  { tid: 1, amount: 1, price: 100, date: 1475837937 },
  { tid: 2, amount: 1, price: 100, date: 1475837938 },
];

// stub the exchange
let FakeProvider = function() {
};
let getTrades = function(since, handler, descending) {
  handler(
    null,
    TRADES,
  );
};
FakeProvider.prototype = {
  getTrades: getTrades,
};

spoofer[providerPath] = FakeProvider;
let getTradesSpy = sinon.spy(FakeProvider.prototype, 'getTrades');

// stub the tradebatcher
let TradeBatcher = require(util.dirs().budfox + 'tradeBatcher');
let tradeBatcherSpy = sinon.spy(TradeBatcher.prototype, 'write');
spoofer[util.dirs().budfox + 'tradeBatcher'] = TradeBatcher;

let MarketFetcher = proxyquire(dirs.budfox + 'marketFetcher', spoofer);

describe('budfox/marketFetcher', function() {
  it('should throw when not passed a config', function() {
    expect(function() {
      new MarketFetcher();
    }).to.throw('TradeFetcher expects a config');
  });

  it('should instantiate', function() {
    mf = new MarketFetcher(config);
  });

  it('should fetch with correct arguments', function() {

    // mf.fetch should call the DataProvider like:
    // provider.getTrades(since, callback, descending)

    mf.fetch();
    expect(getTradesSpy.callCount).to.equal(1);

    let args = getTradesSpy.firstCall.args;

    // test-config uses NO `tradingAdvisor`
    let since = args[0];
    expect(since).to.equal(undefined);

    let handler = args[1];
    assert.isFunction(handler);

    let descending = args[2];
    expect(descending).to.equal(false);
  });

  xit('should retry on error', function() {
    // todo
  });

  it('should pass the data to the tradebatcher', function() {
    mf.fetch();
    expect(getTradesSpy.callCount).to.equal(2);

    expect(tradeBatcherSpy.lastCall.args[0]).to.deep.equal(TRADES);
  });

  xit('should relay trades', function() {
    // todo
  });
});
