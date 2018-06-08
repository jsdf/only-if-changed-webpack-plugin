var fs = require('fs');
var async = require('async');

function getFilesMtimes(files, concurrencyLimit, done) {
  var filesMtimes = {};
  async.eachLimit(files, concurrencyLimit, function(file, fileDone) {
    fs.stat(file, function(statErr, stat) {
      if (statErr) {
        if (statErr.code === 'ENOENT') return fileDone();
        return fileDone(statErr);
      }

      filesMtimes[file] = stat.mtime.getTime();
      fileDone();
    });
  }, function(err) {
    if (err) return done(err);
    done(null, filesMtimes);
  });
}

function getFilesChanges(filesMtimes, concurrencyLimit, done) {
  var changed = [];
  var deleted = [];
  var files = Object.keys(filesMtimes);

  function eachFile(file, fileDone) {
    fs.stat(file, function(err, stat) {
      if (err) {
        deleted.push(file);
        return fileDone();
      }

      var mtimeNew = stat.mtime.getTime();
      if (mtimeNew > Number(filesMtimes[file])) {
        changed.push(file);
      }
      fileDone();
    });
  }

  async.eachLimit(files, concurrencyLimit, eachFile, function() {
    done(deleted, changed);
  });
}

function hasAnyFileChanged(filesMtimes, concurrencyLimit, done) {
  getFilesChanges(filesMtimes, concurrencyLimit, function(deleted, changed) {
    var numFilesChanged = deleted.length + changed.length;
    done(null, numFilesChanged > 0);
  });
}

module.exports = {
  getFilesMtimes: getFilesMtimes,
  hasAnyFileChanged: hasAnyFileChanged,
};
