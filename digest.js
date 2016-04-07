var fs = require('fs');
var crypto = require('crypto');
var async = require('async');

function digestMD5(content) {
  var md5sum = crypto.createHash('md5');
  md5sum.update(content);
  return md5sum.digest('hex');
}

function hasAnyFileChanged(filesHashes, concurrencyLimit, done) {
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
      if (!(filesHashes[file] && hashNew && hashNew !== filesHashes[file])) {
        changed.push(file);
      }
      fileDone();
    });
  }

  async.eachLimit(files, concurrencyLimit, eachFile, function() {
    var numFilesChanged = deleted.length + changed.length;
    done(null, numFilesChanged > 0);
  });
}

module.exports = {
  digestMD5: digestMD5,
  hasAnyFileChanged: hasAnyFileChanged,
};
