let cache = require('../state/cache');
let manager = cache.get('apiKeyManager');

module.exports = {
  get: function *() {
    this.body = manager.get();
  },
  add: function *() {
    let content = this.request.body;

    manager.add(content.exchange, content.values);

    this.body = {
      status: 'ok'
    };
  },
  remove: function *() {
    let exchange = this.request.body.exchange;

    manager.remove(exchange);

    this.body = {
      status: 'ok'
    };
  }
};
