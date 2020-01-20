let EventEmitter = require('events');
let _ = require('lodash');

let exchangeUtils = require('../exchangeUtils');
let bindAll = exchangeUtils.bindAll;
let isValidOrder = exchangeUtils.isValidOrder;
let states = require('./states');

// base order

class BaseOrder extends EventEmitter {
  constructor(api) {
    super();

    this.api = api;

    this.checkInterval = api.interval || 1500;
    this.status = states.INITIALIZING;

    this.completed = false;
    this.completing = false;

    bindAll(this);
  }

  submit({side, amount, price, alreadyFilled}) {
    let check = isValidOrder({
      market: this.market,
      api: this.api,
      amount,
      price
    });

    if(!check.valid) {
      if(alreadyFilled) {
        // partially filled, but the remainder is too
        // small.
        return this.filled();
      }

      this.emit('invalidOrder', check.reason);
      this.rejected(check.reason);
    }

    this.api[this.side](amount, this.price, this.handleCreate);
  }

  setData(data) {
    this.data = data;
  }

  emitStatus() {
    this.emit('statusChange', this.status);
  }

  cancelled() {
    this.status = states.CANCELLED;
    this.emitStatus();
    this.completed = true;
    this.finish();
  }

  rejected(reason) {
    this.rejectedReason = reason;
    this.status = states.REJECTED;
    this.emitStatus();
    console.log(new Date, 'sticky rejected', reason)
    this.finish();
  }

  filled(price) {
    this.status = states.FILLED;
    this.emitStatus();
    this.completed = true;
    console.log(new Date, 'sticky filled')
    this.finish(true);
  }

  finish(filled) {
    this.completed = true;
    this.emit('completed', {
      status: this.status,
      filled
    })
  }
}

module.exports = BaseOrder;
