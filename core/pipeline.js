/*

  A pipeline implements a full Gekko Flow based on a config and
  a mode. The mode is an abstraction that tells Gekko what market
  to load (realtime, backtesting or importing) while making sure
  all enabled plugins are actually supported by that market.

  Read more here:
  https://gekko.wizb.it/docs/internals/architecture.html

*/


let util = require('./util');
let dirs = util.dirs();

let _ = require('lodash');
let async = require('async');

let log = require(dirs.core + 'log');

let pipeline = (settings) => {

  let mode = settings.mode;
  let config = settings.config;

  // prepare a GekkoStream
  let GekkoStream = require(dirs.core + 'gekkoStream');

  // all plugins
  let plugins = [];
  // all emitting plugins
  let emitters = {};
  // all plugins interested in candles
  let candleConsumers = [];

  // utility to check and load plugins.
  let pluginHelper = require(dirs.core + 'pluginUtil');

  // meta information about every plugin that tells Gekko
  // something about every available plugin
  let pluginParameters = require(dirs.gekko + 'plugins');
  // meta information about the events plugins can broadcast
  // and how they should hooked up to consumers.
  let subscriptions = require(dirs.gekko + 'subscriptions');

  let market;

  // Instantiate each enabled plugin
  let loadPlugins = function(next) {
    // load all plugins
    async.mapSeries(
      pluginParameters,
      pluginHelper.load,
      function(error, _plugins) {
        if (error)
          return util.die(error, true);

        plugins = _.compact(_plugins);
        next();
      },
    );
  };

  // Some plugins emit their own events, store
  // a reference to those plugins.
  let referenceEmitters = function(next) {

    _.each(plugins, function(plugin) {
      if (plugin.meta.emits)
        emitters[plugin.meta.slug] = plugin;
    });

    next();
  };

  // Subscribe all plugins to other emitting plugins
  let subscribePlugins = function(next) {
    // events broadcasted by plugins
    let pluginSubscriptions = _.filter(
      subscriptions,
      sub => sub.emitter !== 'market',
    );

    // some events can be broadcasted by different
    // plugins, however the pipeline only allows a single
    // emitting plugin for each event to be enabled.
    _.each(
      pluginSubscriptions.filter(s => _.isArray(s.emitter)),
      subscription => {
        // cache full list
        subscription.emitters = subscription.emitter;
        let singleEventEmitters = subscription.emitter
          .filter(
            s => _.size(plugins.filter(p => p.meta.slug === s)),
          );

        if (_.size(singleEventEmitters) > 1) {
          let error = `Multiple plugins are broadcasting`;
          error += ` the event "${subscription.event}" (${singleEventEmitters.join(',')}).`;
          error += 'This is unsupported.';
          util.die(error);
        } else {
          subscription.emitter = _.first(singleEventEmitters);
        }
      },
    );

    // subscribe interested plugins to
    // emitting plugins
    _.each(plugins, function(plugin) {
      _.each(pluginSubscriptions, function(sub) {

        if (plugin[sub.handler]) {
          // if a plugin wants to listen
          // to something disabled
          if (!emitters[sub.emitter]) {
            if (!plugin.meta.greedy) {

              let emitterMessage;
              if (sub.emitters) {
                emitterMessage = 'all of the emitting plugins [ ';
                emitterMessage += sub.emitters.join(', ');
                emitterMessage += ' ] are disabled.';
              } else {
                emitterMessage = 'the emitting plugin (' + sub.emitter;
                emitterMessage += ')is disabled.';
              }

              log.error([
                plugin.meta.name,
                'wanted to listen to event',
                sub.event + ',',
                'however',
                emitterMessage,
                plugin.meta.name + ' might malfunction because of it.',
              ].join(' '));
            }
            return;
          }

          // attach handler
          emitters[sub.emitter]
            .on(sub.event,
              plugin[
                sub.handler
                ]);
        }

      });
    });

    // events broadcasted by the market
    let marketSubscriptions = _.filter(
      subscriptions,
      { emitter: 'market' },
    );

    // subscribe plugins to the market
    _.each(plugins, function(plugin) {
      _.each(marketSubscriptions, function(sub) {

        if (plugin[sub.handler]) {
          if (sub.event === 'candle')
            candleConsumers.push(plugin);
        }

      });
    });

    next();
  };

  let prepareMarket = function(next) {
    if (mode === 'backtest' && config.backtest.daterange === 'scan')
      require(dirs.core + 'prepareDateRange')(next);
    else
      next();
  };

  let setupMarket = function(next) {
    // load a market based on the config (or fallback to mode)
    let marketType;
    if (config.market)
      marketType = config.market.type;
    else
      marketType = mode;

    let Market = require(dirs.markets + marketType);

    market = new Market(config);

    next();
  };

  let subscribePluginsToMarket = function(next) {

    // events broadcasted by the market
    let marketSubscriptions = _.filter(
      subscriptions,
      { emitter: 'market' },
    );

    _.each(plugins, function(plugin) {
      _.each(marketSubscriptions, function(sub) {

        if (sub.event === 'candle')
          // these are handled via the market stream
          return;

        if (plugin[sub.handler]) {
          market.on(sub.event, plugin[sub.handler]);
        }

      });
    });

    next();

  };

  log.info('Setting up Gekko in', mode, 'mode');
  log.info('');

  async.series(
    [
      loadPlugins,
      referenceEmitters,
      subscribePlugins,
      prepareMarket,
      setupMarket,
      subscribePluginsToMarket,
    ],
    function() {

      let gekkoStream = new GekkoStream(plugins);

      market.pipe(gekkoStream);

      // convert JS objects to JSON string
      // .pipe(new require('stringify-stream')())
      // output to standard out
      // .pipe(process.stdout);

      market.on('end', gekkoStream.finalize);
    },
  );

};

module.exports = pipeline;
