// Small plugin that subscribes to some events, stores
// them and sends it to the parent process.

let log = require('../core/log');
let _ = require('lodash');
let subscriptions = require('../subscriptions');
let config = require('../core/util').getConfig();

let ChildToParent = function() {

  subscriptions
    // .filter(sub => config.childToParent.events.includes(sub.event))
    .forEach(sub => {
      this[sub.handler] = (event, next) => {
        process.send({ type: sub.event, payload: event });
        if (_.isFunction(next)) {
          next();
        }
      };
    }, this);

};

module.exports = ChildToParent;
