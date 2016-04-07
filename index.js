var fs = require('fs');
var path = require('path');

var mtime = require('./mtime');

// hand-tuned optimal concurrency for a 15" macbook pro :)
var CONCURRENCY_LIMIT = 40;

function OnlyIfChangedPlugin(opts) {
  if (!opts.cacheDirectory) throw new Error('missing required opt cacheDirectory');
  if (!opts.cacheIdentifier) throw new Error('missing required opt cacheIdentifier');
  this.cacheDirectory = opts.cacheDirectory;
  this.cacheIdentifier = opts.cacheIdentifier;
  this.concurrencyLimit = opts.concurrencyLimit || CONCURRENCY_LIMIT;
  this.dependenciesMtimes = {};
}

OnlyIfChangedPlugin.prototype.getCacheFilePath = function() {
  return path.join(this.cacheDirectory, this.cacheIdentifier + '-dependenciesMtimes.json');
};

OnlyIfChangedPlugin.prototype.writeCacheFile = function() {
  fs.writeFileSync(this.getCacheFilePath(), JSON.stringify(this.dependenciesMtimes));
};

OnlyIfChangedPlugin.prototype.readCacheFile = function() {
  this.dependenciesMtimes = JSON.parse(fs.readFileSync(this.getCacheFilePath(), {encoding: 'utf8'}));
};

OnlyIfChangedPlugin.prototype.updateMtimes = function(fileDependencies, done) {
  mtime.updateMtimes(fileDependencies, this.dependenciesMtimes, done);
};

OnlyIfChangedPlugin.prototype.apply = function(compiler) {
  var pluginContext = this;

  // upvar tracking whether for a particular webpack run, compilation should be done
  // assumes such runs cannot happen multiple times concurrently per plugin instance
  var shouldCompile = true;

  compiler.plugin('run', function(_, runDone) {
    shouldCompile = true;

    try {
      pluginContext.readCacheFile();
    } catch (readCacheErr) {
      if (readCacheErr.code === 'ENOENT') {
        // cache file missing
        return runDone();
      }

      return runDone(readCacheErr);
    }

    mtime.hasAnyFileChanged(pluginContext.dependenciesMtimes, pluginContext.concurrencyLimit, function(err, anyChanged) {
      if (err) return runDone(err);

      // rebuild if any file changed
      shouldCompile = anyChanged;

      // always rebuild if no known files
      if (Object.keys(pluginContext.dependenciesMtimes).length === 0) {
        shouldCompile = true;
      }

      // clear known files when rebuilding
      if (shouldCompile) {
        pluginContext.dependenciesMtimes = {};
      }

      runDone();
    });
  });

  compiler.plugin('compilation', function(compilation) {
    if (!shouldCompile) {
      // duck punch compilation object to make addEntry a no-op (ignore all entrypoints)
      compilation.addEntry = function(context, entry, name, done) {
        done();
      };
    }
  });

  compiler.plugin('after-compile', function(compilation, afterCompileDone) {
    // get updated mtimes of file dependencies of compilation
    pluginContext.updateMtimes(compilation.fileDependencies, afterCompileDone);
  });

  compiler.plugin('should-emit', function() {
    return shouldCompile;
  });

  compiler.plugin('done', function() {
    if (shouldCompile) {
      pluginContext.writeCacheFile();
    }
  });
};

module.exports = OnlyIfChangedPlugin;
