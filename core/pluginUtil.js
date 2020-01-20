let _ = require('lodash');
let async = require('async');
let Emitter = require('./emitter');

let util = require(__dirname + '/util');

let log = require(util.dirs().core + 'log');

let config = util.getConfig();
let pluginDir = util.dirs().plugins;
let gekkoMode = util.gekkoMode();
let inherits = require('util').inherits;

let pluginHelper = {
  // Checks whether we can load a module

  // @param Object plugin
  //    plugin config object
  // @return String
  //    error message if we can't
  //    use the module.
  cannotLoad: function(plugin) {

    let error;
// verify plugin dependencies are installed
    if(_.has(plugin, 'dependencies')) {
        error = false;
      }

      _.each(plugin.dependencies, function(dep) {
        try {
          let _ = require(dep.module);
        }
        catch(e) {
          log.error('ERROR LOADING DEPENDENCY', dep.module);

          if(!e.message) {
            log.error(e);
            util.die();
          }

          if(!e.message.startsWith('Cannot find module'))
            return util.die(e);

          error = [
            'The plugin',
            plugin.slug,
            'expects the module',
            dep.module,
            'to be installed.',
            'However it is not, install',
            'it by running: \n\n',
            '\tnpm install',
            dep.module + '@' + dep.version
          ].join(' ');
        }
      });

    return error;
  },
  // loads a plugin
  //
  // @param Object plugin
  //    plugin config object
  // @param Function next
  //    callback
  load: function(plugin, next) {

    plugin.config = config[plugin.slug];

    if(!plugin.config || !plugin.config.enabled)
      return next();

    if(!_.contains(plugin.modes, gekkoMode)) {
      log.warn(
        'The plugin',
        plugin.name,
        'does not support the mode',
        gekkoMode + '.',
        'It has been disabled.'
      );
      return next();
    }

    log.info('Setting up:');
    log.info('\t', plugin.name);
    log.info('\t', plugin.description);

    let cannotLoad = pluginHelper.cannotLoad(plugin);
    if(cannotLoad)
      return next(cannotLoad);

    let Constructor = require(pluginDir + ((plugin.path) ? plugin.path(config) : plugin.slug));

    if(plugin.async) {
      inherits(Constructor, Emitter);
      let instance = new Constructor(util.defer(function(err) {
        next(err, instance);
      }), plugin);
      Emitter.call(instance);

      instance.meta = plugin;
    } else {
      inherits(Constructor, Emitter);
      let instance = new Constructor(plugin);
      Emitter.call(instance);

      instance.meta = plugin;
      _.defer(function() {
        next(null, instance);
      });
    }

    if(!plugin.silent)
      log.info('\n');
  }
};

module.exports = pluginHelper;
