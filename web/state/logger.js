let fs = require('fs');
let _ = require('lodash');

let BASEPATH = __dirname + '/../../logs/';

let Logger = function(id) {

  this.fileName = `${id}.log`;

  this.writing = false;
  this.queue = [];

  _.bindAll(this);
};

Logger.prototype.write = function(line) {
  if(!this.writing) {
    this.writing = true;
    fs.appendFile(
      BASEPATH + this.fileName,
      line + '\n',
      this.handleWriteCallback
    );
  } else
    this.queue.push(line);
};

Logger.prototype.handleWriteCallback = function(err) {
  if(err)
    console.error(`ERROR WRITING LOG FILE ${this.fileName}:`, err);

  this.writing = false;

  if(_.size(this.queue))
    this.write(this.queue.shift())
};

module.exports = Logger;
