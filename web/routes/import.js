let _ = require('lodash');
let promisify = require('tiny-promisify');
let pipelineRunner = promisify(require('../../core/workers/pipeline/parent'));

let cache = require('../state/cache');
let broadcast = cache.get('broadcast');
let importManager = cache.get('imports');

let base = require('./baseConfig');

// starts an import
// requires a post body with a config object
module.exports = function *() {
  let mode = 'importer';

  let config = {};

  _.merge(config, base, this.request.body);

  let importId = (Math.random() + '').slice(3);

  let errored = false;

  console.log('Import', importId, 'started');

  pipelineRunner(mode, config, (err, event) => {
    if(errored)
      return;

    if(err) {
      errored = true;
      console.error('RECEIVED ERROR IN IMPORT', importId);
      console.error(err);
      importManager.delete(importId);
      return broadcast({
        type: 'import_error',
        import_id: importId,
        error: err
      });
    }

    if(!event)
      return;

    // update local cache
    importManager.update(importId, {
      latest: event.latest,
      done: event.done
    });

    // emit update over ws
    let wsEvent = {
      type: 'import_update',
      import_id: importId,
      updates: {
        latest: event.latest,
        done: event.done
      }
    };
    broadcast(wsEvent);
  });

  let daterange = this.request.body.importer.daterange;

  let _import = {
    watch: config.watch,
    id: importId,
    latest: '',
    from: daterange.from,
    to: daterange.to
  };

  importManager.add(_import);
  this.body = _import;
};
