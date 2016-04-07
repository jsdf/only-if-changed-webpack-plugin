var fs = require('fs');
var path = require('path');

var mtime = require('./mtime');
var digest = require('./digest');
var SCHEMA_VERSION = 1;

// hand-tuned optimal concurrency for a 15" macbook pro :)
var CONCURRENCY_LIMIT = 40;

function OnlyIfChangedPlugin(opts) {
  if (!opts.cacheDirectory) throw new Error('missing required opt cacheDirectory');
  if (!opts.cacheIdentifier) throw new Error('missing required opt cacheIdentifier');
  this.cacheDirectory = opts.cacheDirectory;
  this.cacheIdentifier = digest.digestSHA1(JSON.stringify(opts.cacheIdentifier));
  this.concurrencyLimit = opts.concurrencyLimit || CONCURRENCY_LIMIT;
  this.cache = makeCacheRecord();
}

OnlyIfChangedPlugin.prototype.getCacheFilePath = function() {
  return path.join(this.cacheDirectory, 'onlyifchanged-' + SCHEMA_VERSION + '-' + this.cacheIdentifier + '.json');
};

OnlyIfChangedPlugin.prototype.writeCacheFile = function() {
  fs.writeFileSync(this.getCacheFilePath(), JSON.stringify(this.cache));
};

OnlyIfChangedPlugin.prototype.readCacheFile = function() {
  this.cache = JSON.parse(fs.readFileSync(this.getCacheFilePath(), {encoding: 'utf8'}));
};

OnlyIfChangedPlugin.prototype.updateDependenciesMtimes = function(fileDependencies, done) {
  var pluginContext = this;
  mtime.getFilesMtimes(fileDependencies, this.concurrencyLimit, function(err, filesMtimes) {
    if (err) return done(err);

    // merge in updated mtimes
    Object.keys(filesMtimes).forEach(function(file) {
      pluginContext.cache.inputFilesMtimes[file] = filesMtimes[file];
    });
    done();
  });
};

OnlyIfChangedPlugin.prototype.updateAssetHash = function(file, contents) {
  this.cache.outputFilesHashes[file] = digest.digestMD5(contents);
};

OnlyIfChangedPlugin.prototype.isCacheEmpty = function() {
  return (
    Object.keys(this.cache.inputFilesMtimes).length === 0 ||
    Object.keys(this.cache.outputFilesHashes).length === 0
  );
};

OnlyIfChangedPlugin.prototype.hasAnyFileChanged = function(done) {
  var pluginContext = this;

  mtime.hasAnyFileChanged(pluginContext.cache.inputFilesMtimes, pluginContext.concurrencyLimit, function(err, anyMtimeChanged) {
    if (err) return done(err);
    if (anyMtimeChanged) return done(null, true);

    digest.hasAnyFileChanged(pluginContext.cache.outputFilesHashes, pluginContext.concurrencyLimit, function(err, anyHashChanged) {
      if (err) return done(err);
      done(null, anyHashChanged);
    });
  });
};

OnlyIfChangedPlugin.prototype.apply = function(compiler) {
  var pluginContext = this;

  // upvar tracking whether for a particular webpack run, compilation should be done
  // assumes such runs cannot happen multiple times concurrently per plugin instance
  var shouldCompile = true;

  // at the very start of the webpack run we determine if we need to rebuild or not
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

    pluginContext.hasAnyFileChanged(function(err, anyChanged) {
      if (err) return runDone(err);

      // rebuild if any file changed
      shouldCompile = anyChanged;

      // always rebuild if no known input or output files
      if (pluginContext.isCacheEmpty()) {
        shouldCompile = true;
      }

      // clear known files when rebuilding
      if (shouldCompile) {
        pluginContext.cache = makeCacheRecord();
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

  // collect info about input dependencies to compilation
  compiler.plugin('after-compile', function(compilation, afterCompileDone) {
    // get updated mtimes of file dependencies of compilation
    pluginContext.updateDependenciesMtimes(compilation.fileDependencies, afterCompileDone);
  });

  compiler.plugin('should-emit', function() {
    // don't emit any files if nothing was built
    return shouldCompile;
  });

  // collect info about output of compilation
  compiler.plugin('after-emit', function(compilation, done) {
    if (!shouldCompile) return done();

    var emittedFiles = Object.keys(compilation.assets).filter(function(file) {
      var source = compilation.assets[file];
      return source.emitted && source.existsAt;
    });

    emittedFiles.forEach(function(file) {
      var source = compilation.assets[file];
      var content = source.source();
      var contentToHash = Buffer.isBuffer(content) ? content : new Buffer(content, 'utf-8');

      pluginContext.updateAssetHash(source.existsAt, contentToHash);
    });

    done();
  });

  compiler.plugin('done', function() {
    if (!shouldCompile) return;

    pluginContext.writeCacheFile();
  });
};

function makeCacheRecord() {
  return {
    inputFilesMtimes: {},
    outputFilesHashes: {},
  };
}

module.exports = OnlyIfChangedPlugin;
