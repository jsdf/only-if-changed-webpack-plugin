var fs = require('fs');
var async = require('async');

function updateMtimes(files, filesMtimes, done) {
  async.forEach(files, function(file, fileDone) {
    fs.stat(file, function(statErr, stat) {
      if (statErr) {
        if (statErr.code === 'ENOENT') return fileDone();
        return fileDone(statErr);
      }

      filesMtimes[file] = stat.mtime.getTime();
      fileDone();
    });
  }, done);
}

function hasAnyFileChanged(filesMtimes, concurrencyLimit, done) {
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
      if (!(filesMtimes[file] && mtimeNew && mtimeNew <= filesMtimes[file])) {
        changed.push(file);
      }
      filesMtimes[file] = mtimeNew;
      fileDone();
    });
  }

  async.eachLimit(files, concurrencyLimit, eachFile, function() {
    var numFilesChanged = deleted.length + changed.length;
    done(null, numFilesChanged > 0);
  });
}

module.exports = {
  updateMtimes: updateMtimes,
  hasAnyFileChanged: hasAnyFileChanged,
};
