
// if you need to test Gekko against real mocked data
// uncomment the following:

// let fs = require('fs');
// let bitstamp = require('bitstamp');
// let bs = new bitstamp;
// bs.transactions('btcusd', (err, data) => {
//   if(err)
//     throw err;

//   let json = JSON.stringify(data, null, 4);
//   fs.writeFileSync('./data/bitstamp_trades.json', json);
// });
// return;

let chai = require('chai');
let expect = chai.expect;
let should = chai.should;
let sinon = require('sinon');
let proxyquire = require('proxyquire');

let _ = require('lodash');
let moment = require('moment');

let util = require(__dirname + '/../../core/util');
let config = util.getConfig();
let dirs = util.dirs();

let TRADES = require('./data/bitstamp_trades.json');

return; // TEMP

let FakeExchange = function() {};
FakeExchange.prototype = {
  transactions: function(since, handler, descending) {
    handler(
      null,
      TRADES
    );
  }
};
let transactionsSpy = sinon.spy(FakeExchange.prototype, 'transactions');
spoofer = {
  bitstamp: FakeExchange
};

describe('exchanges/bitstamp', function() {
  let Bitstamp = proxyquire(dirs.gekko + 'exchange/wrappers/bitstamp', spoofer);
  let bs;

  it('should instantiate', function() {
    bs = new Bitstamp(config.watch);
  });

  it('should correctly fetch historical trades', function() {
    bs.getTrades(null, _.noop, false);

    expect(transactionsSpy.callCount).to.equal(1);

    let args = transactionsSpy.lastCall.args;
    expect(args.length).to.equal(2);

    expect(args[0]).to.equal('btcusd');
  });

  it('should retry on exchange error', function() {
    let ErrorFakeExchange = function() {};
    ErrorFakeExchange.prototype = {
      transactions: function(since, handler, descending) {
        handler('Auth error');
      }
    }
    spoofer = {
      bitstamp: ErrorFakeExchange
    }

    let ErroringBitstamp = proxyquire(dirs.exchanges + 'bitstamp', spoofer);
    let ebs = new ErroringBitstamp(config.watch);

    ebs.retry = _.noop;
    let retrySpy = sinon.spy(ebs, 'retry');

    ebs.getTrades(null, _.noop)

    expect(retrySpy.callCount).to.equal(1);

    let args = retrySpy.lastCall.args;
    expect(args[1].length).to.equal(2);
    expect(args[1][0]).to.equal(null);
  });

  it('should correctly parse historical trades', function(done) {
    let check = function(err, trades) {

      expect(err).to.equal(null);

      expect(trades.length).to.equal(TRADES.length);

      let oldest = _.first(trades);
      let OLDEST = _.last(TRADES);

      expect(oldest.tid).to.equal(+OLDEST.tid);
      expect(oldest.price).to.equal(+OLDEST.price);
      expect(oldest.amount).to.equal(+OLDEST.amount);
      expect(oldest.date).to.equal(OLDEST.date);

      done();
    };

    bs.getTrades(null, check, false);

  });
});
