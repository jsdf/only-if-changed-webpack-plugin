var fs = require('fs');
var test = require('tap').test;
var path = require('path');
var webpack = require('webpack');

var OnlyIfChangedPlugin = require('../');
var webpackConfig = require('../support/webpack.config.js');
var testUtils = require('../support/testUtils');

var entry = path.join(testUtils.testOutputDir, 'entry.js');

test('it builds valid bundles when files change', (t) => {
  var bundleFile1 = 'bundle-1.js';

  var dependency1 = path.join(testUtils.testOutputDir, 'stuff.js');
  var dependency2 = path.join(testUtils.testOutputDir, 'stuff2.js');
  var inputContent1 = 'console.log("123")';
  var inputContent2 = 'console.log("567")';

  testUtils.cleanupTestOutputDir((cleanupErr) => {
    t.notOk(cleanupErr, 'clean up test output dir');

    writeFile(entry, `require('${dependency1}');`);
    writeFile(dependency1, inputContent1);
    writeFile(dependency2, inputContent2);
    var bundleOutputFile = path.join(testUtils.testOutputDir, bundleFile1);

    doBuild(bundleFile1, (build1Err) => {
      t.notOk(build1Err, 'built first time');

      var output1 = readFile(bundleOutputFile);
      t.match(output1, inputContent1, 'built bundle containing initial content');

      fs.unlinkSync(bundleOutputFile);

      writeFile(entry, `require('${dependency2}');`);
      doBuild(bundleFile1, build2err => {
        t.notOk(build2err, 'built second time');

        var output2 = readFile(bundleOutputFile);
        t.match(output2, inputContent2, 'built bundle containing changed content');

        t.end();
      });
    });
  });
});

test('it does not rebuild when files do not change', (t) => {
  var bundleFile1 = 'bundle-1.js';
  var dependency1 = path.join(testUtils.testOutputDir, 'stuff.js');
  var inputContent1 = 'console.log("123")';

  testUtils.cleanupTestOutputDir((cleanupErr) => {
    t.notOk(cleanupErr, 'clean up test output dir');

    writeFile(entry, `require('${dependency1}');`);
    writeFile(dependency1, inputContent1);
    var bundleOutputFile = path.join(testUtils.testOutputDir, bundleFile1);
    doBuild(bundleFile1, (build1Err) => {
      t.notOk(build1Err, 'built first time');

      var output1 = readFile(bundleOutputFile);
      t.match(output1, inputContent1, 'built bundle containing initial content');

      fs.unlinkSync(bundleOutputFile);

      doBuild(bundleFile1, build2Err => {
        t.notOk(build2Err, 'built second time');

        t.notOk(fs.existsSync(bundleOutputFile), 'does not rebuild files');

        t.end();
      });
    });
  });
});

var READ_FILE_TIMEOUT = 2000;
function readFile(filepath) {
  var start = Date.now();
  var contents = null;
  var outOfTime = false;
  while (!outOfTime) {
    try {
      contents = fs.readFileSync(filepath, {encoding: 'utf8'});
    } catch (err) {
      // file doesn't exist yet
    }
    outOfTime = Date.now() > start + READ_FILE_TIMEOUT;
  }

  if (contents == null) {
    throw new Error('Timeout waiting for file read');
  }
  return contents;
}

function writeFile(filepath, content) {
  fs.writeFileSync(filepath, content, {encoding: 'utf8'});
}

function doBuild(filename, done) {
  webpackConfig.entry = entry;

  webpackConfig.output.filename = filename;
  webpackConfig.plugins = [
    new OnlyIfChangedPlugin({
      cacheDirectory: testUtils.testOutputDir,
      cacheIdentifier: 'cache',
    }),
  ];

  webpack(webpackConfig, function(err, stats) {
    if (err) return done(err);
    var jsonStats = stats.toJson();
    if (jsonStats.errors.length > 0) {
      console.error.apply(console, jsonStats.errors);
      console.error.apply(console, jsonStats.errorDetails);
      return done(new Error(jsonStats.errors.join(', ')));
    }
    if (jsonStats.warnings.length > 0) {
      console.error.apply(console, jsonStats.warnings);
    }

    testUtils.waitForIOSettle(done);
  });
}
