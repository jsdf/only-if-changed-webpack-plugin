var fs = require('fs');
var crypto = require('crypto');
var async = require('async');

function digestMD5(content) {
  var md5sum = crypto.createHash('md5');
  md5sum.update(content);
  return md5sum.digest('hex');
}

function digestSHA1(content) {
  var sha1sum = crypto.createHash('sha1');
  sha1sum.update(content);
  return sha1sum.digest('hex');
}

function getFilesChanges(filesHashes, concurrencyLimit, done) {
  var changed = [];
  var deleted = [];
  var files = Object.keys(filesHashes);

  function eachFile(file, fileDone) {
    fs.readFile(file, function(err, contents) {
      if (err) {
        deleted.push(file);
        return fileDone();
      }

      var hashNew = digestMD5(contents);
      if (!(filesHashes[file] && hashNew && filesHashes[file] === hashNew)) {
        changed.push(file);
      }
      fileDone();
    });
  }

  async.eachLimit(files, concurrencyLimit, eachFile, function() {
    done(deleted, changed);
  });
}


function hasAnyFileChanged(filesHashes, concurrencyLimit, done) {
  getFilesChanges(filesHashes, concurrencyLimit, function(deleted, changed) {
    var numFilesChanged = deleted.length + changed.length;
    done(null, numFilesChanged > 0);
  });
}

module.exports = {
  digestSHA1: digestSHA1,
  digestMD5: digestMD5,
  hasAnyFileChanged: hasAnyFileChanged,
};
