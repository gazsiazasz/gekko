let _ = require('lodash');
let moment = require('moment');

let statslite = require('stats-lite');
let util = require('../../core/util');
let log = require(util.dirs().core + 'log');
let ENV = util.gekkoEnv();

let config = util.getConfig();
let perfConfig = config.performanceAnalyzer;
let watchConfig = config.watch;

let Logger = require('./logger');

let PerformanceAnalyzer = function() {
  _.bindAll(this);

  this.dates = {
    start: false,
    end: false,
  };

  this.startPrice = 0;
  this.endPrice = 0;

  this.currency = watchConfig.currency;
  this.asset = watchConfig.asset;

  this.logger = new Logger(watchConfig);

  this.trades = 0;

  this.exposure = 0;

  this.roundTrips = [];
  this.losses = [];
  this.roundTrip = {
    id: 0,
    entry: false,
    exit: false,
  };

  this.portfolio = {};
  this.balance;

  this.start = {};
  this.openRoundTrip = false;

  this.warmupCompleted = false;
};

PerformanceAnalyzer.prototype.processPortfolioValueChange = function(event) {
  if (!this.start.balance) {
    this.start.balance = event.balance;
  }

  this.balance = event.balance;
};

PerformanceAnalyzer.prototype.processPortfolioChange = function(event) {
  if (!this.start.portfolio) {
    this.start.portfolio = event;
  }
};

PerformanceAnalyzer.prototype.processStratWarmupCompleted = function() {
  this.warmupCompleted = true;
  this.processCandle(this.warmupCandle, _.noop);
};

PerformanceAnalyzer.prototype.processCandle = function(candle, done) {
  if (!this.warmupCompleted) {
    this.warmupCandle = candle;
    return done();
  }

  this.price = candle.close;
  this.dates.end = candle.start.clone().add(1, 'minute');

  if (!this.dates.start) {
    this.dates.start = candle.start;
    this.startPrice = candle.close;
  }

  this.endPrice = candle.close;

  if (this.openRoundTrip) {
    this.emitRoundtripUpdate();
  }

  done();
};

PerformanceAnalyzer.prototype.emitRoundtripUpdate = function() {
  let uPnl = this.price - this.roundTrip.entry.price;

  this.deferredEmit('roundtripUpdate', {
    at: this.dates.end,
    duration: this.dates.end.diff(this.roundTrip.entry.date),
    uPnl,
    uProfit: uPnl / this.roundTrip.entry.total * 100,
  });
};

PerformanceAnalyzer.prototype.processTradeCompleted = function(trade) {
  this.trades++;
  this.portfolio = trade.portfolio;
  this.balance = trade.balance;

  this.registerRoundtripPart(trade);

  let report = this.calculateReportStatistics();
  if (report) {
    this.logger.handleTrade(trade, report);
    this.deferredEmit('performanceReport', report);
  }
};

PerformanceAnalyzer.prototype.registerRoundtripPart = function(trade) {
  if (this.trades === 1 && trade.action === 'sell') {
    // this is not part of a valid roundtrip
    return;
  }

  if (trade.action === 'buy') {
    if (this.roundTrip.exit) {
      this.roundTrip.id++;
      this.roundTrip.exit = false;
    }

    this.roundTrip.entry = {
      date: trade.date,
      price: trade.price,
      total: trade.portfolio.currency + (trade.portfolio.asset * trade.price),
    };
    this.openRoundTrip = true;
  } else if (trade.action === 'sell') {
    this.roundTrip.exit = {
      date: trade.date,
      price: trade.price,
      total: trade.portfolio.currency + (trade.portfolio.asset * trade.price),
    };
    this.openRoundTrip = false;

    this.handleCompletedRoundtrip();
  }
};

PerformanceAnalyzer.prototype.handleCompletedRoundtrip = function() {
  let roundtrip = {
    id: this.roundTrip.id,

    entryAt: this.roundTrip.entry.date,
    entryPrice: this.roundTrip.entry.price,
    entryBalance: this.roundTrip.entry.total,

    exitAt: this.roundTrip.exit.date,
    exitPrice: this.roundTrip.exit.price,
    exitBalance: this.roundTrip.exit.total,

    duration: this.roundTrip.exit.date.diff(this.roundTrip.entry.date),
  };

  roundtrip.pnl = roundtrip.exitBalance - roundtrip.entryBalance;
  roundtrip.profit = (100 * roundtrip.exitBalance / roundtrip.entryBalance) - 100;

  this.roundTrips[this.roundTrip.id] = roundtrip;

  this.logger.handleRoundtrip(roundtrip);

  this.deferredEmit('roundtrip', roundtrip);

  // update cached exposure
  this.exposure = this.exposure + Date.parse(this.roundTrip.exit.date) - Date.parse(this.roundTrip.entry.date);
  // track losses separately for downside report
  if (roundtrip.exitBalance < roundtrip.entryBalance)
    this.losses.push(roundtrip);

};

PerformanceAnalyzer.prototype.calculateReportStatistics = function() {
  if (!this.start.balance || !this.start.portfolio) {
    log.error('Cannot calculate a profit report without having received portfolio data.');
    log.error('Skipping performanceReport..');
    return false;
  }

  // the portfolio's balance is measured in {currency}
  let profit = this.balance - this.start.balance;

  let timespan = moment.duration(
    this.dates.end.diff(this.dates.start),
  );
  let relativeProfit = this.balance / this.start.balance * 100 - 100;
  let relativeYearlyProfit = relativeProfit / timespan.asYears();

  let percentExposure = this.exposure / (Date.parse(this.dates.end) - Date.parse(this.dates.start));

  let sharpe = (relativeYearlyProfit - perfConfig.riskFreeReturn)
    / statslite.stdev(this.roundTrips.map(r => r.profit))
    / Math.sqrt(this.trades / (this.trades - 2));

  let downside = statslite.percentile(this.losses.map(r => r.profit), 0.25)
    * Math.sqrt(this.trades / (this.trades - 2));

  let ratioRoundTrips = this.roundTrips.length > 0 ? (this.roundTrips.filter(roundTrip => roundTrip.pnl > 0).length / this.roundTrips.length * 100).toFixed(4) : 100;

  let report = {
    startTime: this.dates.start.utc().format('YYYY-MM-DD HH:mm:ss'),
    endTime: this.dates.end.utc().format('YYYY-MM-DD HH:mm:ss'),
    timespan: timespan.humanize(),
    market: this.endPrice * 100 / this.startPrice - 100,

    balance: this.balance,
    profit,
    relativeProfit: relativeProfit,

    yearlyProfit: profit / timespan.asYears(),
    relativeYearlyProfit,

    startPrice: this.startPrice,
    endPrice: this.endPrice,
    trades: this.trades,
    startBalance: this.start.balance,
    exposure: percentExposure,
    sharpe,
    downside,
    ratioRoundTrips,
  };

  report.alpha = report.relativeProfit - report.market;

  return report;
};

PerformanceAnalyzer.prototype.finalize = function(done) {
  if (!this.trades) {
    return done();
  }

  let report = this.calculateReportStatistics();
  if (report) {
    this.logger.finalize(report);
    this.emit('performanceReport', report);
  }
  done();
};

module.exports = PerformanceAnalyzer;
