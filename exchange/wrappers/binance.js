let moment = require('moment');
let _ = require('lodash');

let Errors = require('../exchangeErrors');
let marketData = require('./binance-markets.json');
let exchangeUtils = require('../exchangeUtils');
let retry = exchangeUtils.retry;
let scientificToDecimal = exchangeUtils.scientificToDecimal;

let Binance = require('binance');

let Trader = function(config) {
  _.bindAll(this, [
    'roundAmount',
    'roundPrice',
    'isValidPrice',
    'isValidLot',
  ]);

  if (_.isObject(config)) {
    this.key = config.key;
    this.secret = config.secret;
    this.currency = config.currency.toUpperCase();
    this.asset = config.asset.toUpperCase();
  }

  let recvWindow = 6000;
  if (config.optimizedConnection) {
    // there is a bug in binance's API
    // where some requests randomly take
    // over a second, this tells binance
    // to bail out after 500ms.
    //
    // As discussed in binance API
    // telegram. TODO add link.
    recvWindow = 500;
  }

  this.pair = this.asset + this.currency;
  this.name = 'binance';

  this.market = _.find(Trader.getCapabilities().markets, (market) => {
    return market.pair[0] === this.currency && market.pair[1] === this.asset;
  });

  this.binance = new Binance.BinanceRest({
    key: this.key,
    secret: this.secret,
    timeout: 15000,
    recvWindow,
    disableBeautification: false,
    handleDrift: true,
  });

  if (config.key && config.secret) {
    // Note non standard func:
    //
    // On binance we might pay fees in BNB
    // if we do we CANNOT calculate feePercent
    // since we don't track BNB price (when we
    // are not trading on a BNB market).
    //
    // Though we can deduce feePercent based
    // on user fee tracked through `this.getFee`.
    // Set default here, overwrite in getFee.
    this.fee = 0.001;
    // Set the proper fee asap.
    this.getFee(_.noop);

    this.oldOrder = false;
  }
};

let recoverableErrors = [
  'SOCKETTIMEDOUT',
  'TIMEDOUT',
  'CONNRESET',
  'CONNREFUSED',
  'NOTFOUND',
  'Error -1021',
  'Response code 429',
  'Response code 5',
  'Response code 403',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  // getaddrinfo EAI_AGAIN api.binance.com api.binance.com:443
  'EAI_AGAIN',
  'ENETUNREACH',
];

let includes = (str, list) => {
  if (!_.isString(str))
    return false;

  return _.some(list, item => str.includes(item));
};

Trader.prototype.handleResponse = function(funcName, callback) {
  return (error, body) => {
    if (body && body.code) {
      error = new Error(`Error ${body.code}: ${body.msg}`);
    }

    if (error) {
      if (_.isString(error)) {
        error = new Error(error);
      }

      if (includes(error.message, recoverableErrors)) {
        error.notFatal = true;
      }

      if (funcName === 'cancelOrder' && error.message.includes('UNKNOWN_ORDER')) {
        console.log(new Date, 'cancelOrder', 'UNKNOWN_ORDER');
        // order got filled in full before it could be
        // cancelled, meaning it was NOT cancelled.
        return callback(false, { filled: true });
      }

      if (funcName === 'checkOrder' && error.message.includes('Order does not exist.')) {
        console.log(new Date, 'Binance doesnt know this order, retrying up to 10 times..');
        error.retry = 10;
      }

      if (funcName === 'addOrder' && error.message.includes('Account has insufficient balance')) {
        console.log(new Date, 'insufficientFunds');
        error.type = 'insufficientFunds';
      }

      return callback(error);
    }

    return callback(undefined, body);
  };
};

Trader.prototype.getTrades = function(since, callback, descending) {
  let processResults = (err, data) => {
    if (err) return callback(err);

    let parsedTrades = [];
    _.each(
      data,
      function(trade) {
        parsedTrades.push({
          tid: trade.aggTradeId,
          date: moment(trade.timestamp).unix(),
          price: parseFloat(trade.price),
          amount: parseFloat(trade.quantity),
        });
      },
      this,
    );

    if (descending) callback(null, parsedTrades.reverse());
    else callback(undefined, parsedTrades);
  };

  let reqData = {
    symbol: this.pair,
  };

  if (since) {
    let endTs = moment(since)
      .add(1, 'h')
      .valueOf();
    let nowTs = moment().valueOf();

    reqData.startTime = moment(since).valueOf();
    reqData.endTime = endTs > nowTs ? nowTs : endTs;
  }

  let fetch = cb => this.binance.aggTrades(reqData, this.handleResponse('getTrades', cb));
  retry(undefined, fetch, processResults);
};

Trader.prototype.getPortfolio = function(callback) {
  let setBalance = (err, data) => {
    if (err) return callback(err);

    let findAsset = item => item.asset === this.asset;
    let assetAmount = parseFloat(_.find(data.balances, findAsset).free);

    let findCurrency = item => item.asset === this.currency;
    let currencyAmount = parseFloat(_.find(data.balances, findCurrency).free);

    if (!_.isNumber(assetAmount) || _.isNaN(assetAmount)) {
      assetAmount = 0;
    }

    if (!_.isNumber(currencyAmount) || _.isNaN(currencyAmount)) {
      currencyAmount = 0;
    }

    let portfolio = [
      { name: this.asset, amount: assetAmount },
      { name: this.currency, amount: currencyAmount },
    ];

    return callback(undefined, portfolio);
  };

  let fetch = cb => this.binance.account({}, this.handleResponse('getPortfolio', cb));
  retry(undefined, fetch, setBalance);
};

Trader.prototype.getFee = function(callback) {

  // binance does NOT tell us whether the user is using BNB to pay
  // for fees, which means a discount (effectively lower fees)
  let handle = (err, data) => {
    if (err) {
      return callback(err);
    }
    let basepoints = data.makerCommission;

    /** Binance raw response
     { makerCommission: 10,
      takerCommission: 10,
      buyerCommission: 0,
      sellerCommission: 0,
      canTrade: true,
      canWithdraw: true,
      canDeposit: true,
      So to get decimal representation of fee we actually need to divide by 10000
     */
    // note non standard func, see constructor
    this.fee = basepoints / 10000;

    callback(undefined, this.fee);
  };

  let fetch = cb => this.binance.account({}, this.handleResponse('getFee', cb));
  retry(undefined, fetch, handle);
};

Trader.prototype.getTicker = function(callback) {
  let setTicker = (err, data) => {
    if (err)
      return callback(err);

    let result = _.find(data, ticker => ticker.symbol === this.pair);

    if (!result)
      return callback(new Error(`Market ${this.pair} not found on Binance`));

    let ticker = {
      ask: parseFloat(result.askPrice),
      bid: parseFloat(result.bidPrice),
    };

    callback(undefined, ticker);
  };

  let handler = cb => this.binance._makeRequest({}, this.handleResponse('getTicker', cb), 'api/v1/ticker/allBookTickers');
  retry(undefined, handler, setTicker);
};

// Effectively counts the number of decimal places, so 0.001 or 0.234 results in 3
Trader.prototype.getPrecision = function(tickSize) {
  if (!isFinite(tickSize)) return 0;
  let e = 1, p = 0;
  while (Math.round(tickSize * e) / e !== tickSize) {
    e *= 10;
    p++;
  }
  return p;
};

Trader.prototype.round = function(amount, tickSize) {
  let precision = 100000000;
  let t = this.getPrecision(tickSize);

  if (Number.isInteger(t))
    precision = Math.pow(10, t);

  amount *= precision;
  amount = Math.floor(amount);
  amount /= precision;

  // https://gist.github.com/jiggzson/b5f489af9ad931e3d186
  amount = scientificToDecimal(amount);

  return amount;
};

Trader.prototype.roundAmount = function(amount) {
  return this.round(amount, this.market.minimalOrder.amount);
};

Trader.prototype.roundPrice = function(price) {
  return this.round(price, this.market.minimalOrder.price);
};

Trader.prototype.isValidPrice = function(price) {
  return price >= this.market.minimalOrder.price;
};

Trader.prototype.isValidLot = function(price, amount) {
  return amount * price >= this.market.minimalOrder.order;
};

Trader.prototype.outbidPrice = function(price, isUp) {
  let newPrice;

  if (isUp) {
    newPrice = price + this.market.minimalOrder.price;
  } else {
    newPrice = price - this.market.minimalOrder.price;
  }

  return this.roundPrice(newPrice);
};

Trader.prototype.addOrder = function(tradeType, amount, price, callback) {
  let setOrder = (err, data) => {
    if (err) return callback(err);

    let txid = data.orderId;

    callback(undefined, txid);
  };

  let reqData = {
    symbol: this.pair,
    side: tradeType.toUpperCase(),
    type: 'LIMIT',
    timeInForce: 'GTC',
    quantity: amount,
    price: price,
    timestamp: new Date().getTime(),
  };

  let handler = cb => this.binance.newOrder(reqData, this.handleResponse('addOrder', cb));
  retry(undefined, handler, setOrder);
};

Trader.prototype.getOpenOrders = function(callback) {

  let get = (err, data) => {
    if (err) {
      return callback(err);
    }

    callback(null, data.map(o => o.orderId));
  };

  let reqData = {
    symbol: this.pair,
  };

  let handler = cb => this.binance.openOrders(reqData, this.handleResponse('getOpenOrders', cb));
  retry(undefined, handler, get);
};

Trader.prototype.getOrder = function(order, callback) {
  let get = (err, data) => {
    if (err) return callback(err);

    let price = 0;
    let amount = 0;
    let date = moment(0);

    let fees = {};

    if (!data.length) {
      return callback(new Error('Binance did not return any trades'));
    }

    let trades = _.filter(data, t => {
      // note: the API returns a string after creating
      return t.orderId === order;
    });

    if (!trades.length) {
      console.log('cannot find trades!', { order, list: data.map(t => t.orderId).reverse() });

      let reqData = {
        symbol: this.pair,
        orderId: order,
      };

      this.binance.queryOrder(reqData, (err, resp) => {
        console.log('couldnt find any trade for order, here is order:', { err, resp });

        callback(new Error('Trades not found'));
      });

      return;
    }

    _.each(trades, trade => {
      date = moment(trade.time);
      price = ((price * amount) + (+trade.price * trade.qty)) / (+trade.qty + amount);
      amount += +trade.qty;

      if (fees[trade.commissionAsset])
        fees[trade.commissionAsset] += (+trade.commission);
      else
        fees[trade.commissionAsset] = (+trade.commission);
    });

    let feePercent;
    if (_.keys(fees).length === 1) {
      if (fees.BNB && this.asset !== 'BNB' && this.currency !== 'BNB') {
        // we paid fees in BNB, right now that means the fee is always 75%
        // of base fee. We cannot calculate since we do not have the BNB rate.
        feePercent = this.fee * 0.75;
      } else {
        if (fees[this.asset]) {
          feePercent = fees[this.asset] / amount * 100;
        } else if (fees.currency) {
          feePercent = fees[this.currency] / price / amount * 100;
        } else {
          // use user fee of 10 basepoints
          feePercent = this.fee;
        }
      }
    } else {
      // we paid fees in multiple currencies?
      // assume user fee
      feePercent = this.fee;
    }

    callback(undefined, { price, amount, date, fees, feePercent });
  };

  let reqData = {
    symbol: this.pair,
    // if this order was not part of the last 500 trades we won't find it..
    limit: 1000,
  };

  let handler = cb => this.binance.myTrades(reqData, this.handleResponse('getOrder', cb));
  retry(undefined, handler, get);
};

Trader.prototype.buy = function(amount, price, callback) {
  this.addOrder('buy', amount, price, callback);
};

Trader.prototype.sell = function(amount, price, callback) {
  this.addOrder('sell', amount, price, callback);
};

Trader.prototype.checkOrder = function(order, callback) {

  let check = (err, data) => {
    if (err) {
      return callback(err);
    }

    if (data.filled === true) {
      // binance responsed with order not found
      return callback(undefined, { executed: true, open: false });
    }

    let status = data.status;

    if (
      status === 'CANCELED' ||
      status === 'REJECTED' ||
      // for good measure: GB does not
      // submit orders that can expire yet
      status === 'EXPIRED'
    ) {
      return callback(undefined, { executed: false, open: false });
    } else if (
      status === 'NEW' ||
      status === 'PARTIALLY_FILLED'
    ) {
      return callback(undefined, { executed: false, open: true, filledAmount: +data.executedQty });
    } else if (status === 'FILLED') {
      return callback(undefined, { executed: true, open: false });
    }

    console.log('what status?', status);
    throw status;
  };

  let reqData = {
    symbol: this.pair,
    orderId: order,
  };

  let fetcher = cb => this.binance.queryOrder(reqData, this.handleResponse('checkOrder', cb));
  retry(undefined, fetcher, check);
};

Trader.prototype.cancelOrder = function(order, callback) {

  let cancel = (err, data) => {

    this.oldOrder = order;

    if (err) {
      return callback(err);
    }

    if (data && data.filled) {
      return callback(undefined, true);
    }

    return callback(undefined, false);
  };

  let reqData = {
    symbol: this.pair,
    orderId: order,
  };

  let fetcher = cb => this.binance.cancelOrder(reqData, this.handleResponse('cancelOrder', cb));
  retry(undefined, fetcher, cancel);
};

Trader.getCapabilities = function() {
  return {
    name: 'Binance',
    slug: 'binance',
    currencies: marketData.currencies,
    assets: marketData.assets,
    markets: marketData.markets,
    requires: ['key', 'secret'],
    providesHistory: 'date',
    providesFullHistory: true,
    tid: 'tid',
    tradable: true,
    gekkoBroker: 0.6,
    limitedCancelConfirmation: true,
  };
};

module.exports = Trader;
