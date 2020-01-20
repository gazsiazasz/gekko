// overwrite config with test-config

let utils = require(__dirname + '/../core/util');
let testConfig = require(__dirname + '/test-config.json');
utils.setConfig(testConfig);
