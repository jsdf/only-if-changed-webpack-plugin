var fs = require('fs');
var test = require('tap').test;
var path = require('path');
var webpack = require('webpack');

var OnlyIfChangedPlugin = require('../');
var webpackConfig = require('../support/webpack.config.js');
var testUtils = require('../support/testUtils');
var readFile = testUtils.readFile;
var writeFile = testUtils.writeFile;
var cleanupTestOutputDir = testUtils.cleanupTestOutputDir;
var testOutputDir = testUtils.testOutputDir;
var waitForIOSettle = testUtils.waitForIOSettle;

var entry = path.join(testOutputDir, 'entry.js');

test('it rebuilds when input files change', (t) => {
  var bundleFile1 = 'bundle-1.js';

  var dependency1 = path.join(testOutputDir, 'stuff.js');
  var dependency2 = path.join(testOutputDir, 'stuff2.js');
  var inputContent1 = 'console.log("123")';
  var inputContent2 = 'console.log("567")';

  cleanupTestOutputDir((cleanupErr) => {
    t.notOk(cleanupErr, 'clean up test output dir');

    writeFile(entry, `require('${dependency1}');`);
    writeFile(dependency1, inputContent1);
    writeFile(dependency2, inputContent2);
    var bundleOutputFile = path.join(testOutputDir, bundleFile1);

    doBuild(bundleFile1, (build1Err) => {
      t.notOk(build1Err, 'built first time');

      var output1 = readFile(bundleOutputFile);
      t.match(output1, inputContent1, 'built bundle containing initial content');

      var mtime1 = fs.statSync(bundleOutputFile).mtime.getTime();

      writeFile(entry, `require('${dependency2}');`);
      doBuild(bundleFile1, build2err => {
        t.notOk(build2err, 'built second time');

        var mtime2 = fs.statSync(bundleOutputFile).mtime.getTime();
        t.ok(mtime1 !== mtime2, 'does rebuild files');

        var output2 = readFile(bundleOutputFile);
        t.match(output2, inputContent2, 'built bundle containing changed content');

        t.end();
      });
    });
  });
});

test('it rebuilds when output files change', (t) => {
  var bundleFile1 = 'bundle-1.js';
  var dependency1 = path.join(testOutputDir, 'stuff.js');
  var inputContent1 = 'console.log("123")';

  cleanupTestOutputDir((cleanupErr) => {
    t.notOk(cleanupErr, 'clean up test output dir');

    writeFile(entry, `require('${dependency1}');`);
    writeFile(dependency1, inputContent1);
    var bundleOutputFile = path.join(testOutputDir, bundleFile1);
    doBuild(bundleFile1, (build1Err) => {
      t.notOk(build1Err, 'built first time');

      var output1 = readFile(bundleOutputFile);
      t.match(output1, inputContent1, 'built bundle containing initial content');

      fs.unlinkSync(bundleOutputFile);

      doBuild(bundleFile1, build2Err => {
        t.notOk(build2Err, 'built second time');

        t.ok(fs.existsSync(bundleOutputFile), 'does rebuild files');

        t.end();
      });
    });
  });
});

test('when input and output files do not change', (t) => {
  var test = t.test;

  test('it does not rebuild', (t) => {
    var bundleFile1 = 'bundle-1.js';
    var dependency1 = path.join(testOutputDir, 'stuff.js');
    var inputContent1 = 'console.log("123")';

    cleanupTestOutputDir((cleanupErr) => {
      t.notOk(cleanupErr, 'clean up test output dir');

      writeFile(entry, `require('${dependency1}');`);
      writeFile(dependency1, inputContent1);
      var bundleOutputFile = path.join(testOutputDir, bundleFile1);
      doBuild(bundleFile1, (build1Err) => {
        t.notOk(build1Err, 'built first time');

        var output1 = readFile(bundleOutputFile);
        t.match(output1, inputContent1, 'built bundle containing initial content');

        var mtime1 = fs.statSync(bundleOutputFile).mtime.getTime();

        doBuild(bundleFile1, build2Err => {
          t.notOk(build2Err, 'built second time');

          var mtime2 = fs.statSync(bundleOutputFile).mtime.getTime();
          t.ok(mtime1 === mtime2, 'does not rebuild files');

          t.end();
        });
      });
    });
  });

  test('it does not rebuild when a file has Epoch timestamp', (t) => {
    // see https://github.com/npm/npm/issues/19968#issuecomment-372799983 for why we need to support this

    var bundleFile1 = 'bundle-1.js';
    var dependency1 = path.join(testOutputDir, 'stuff.js');
    var inputContent1 = 'console.log("123")';

    cleanupTestOutputDir((cleanupErr) => {
      t.notOk(cleanupErr, 'clean up test output dir');

      writeFile(entry, `require('${dependency1}');`);
      writeFile(dependency1, inputContent1, 0); // zero timestamp
      var bundleOutputFile = path.join(testOutputDir, bundleFile1);
      doBuild(bundleFile1, (build1Err) => {
        t.notOk(build1Err, 'built first time');

        var output1 = readFile(bundleOutputFile);
        t.match(output1, inputContent1, 'built bundle containing initial content');

        var mtime1 = fs.statSync(bundleOutputFile).mtime.getTime();

        doBuild(bundleFile1, build2Err => {
          t.notOk(build2Err, 'built second time');

          var mtime2 = fs.statSync(bundleOutputFile).mtime.getTime();
          t.ok(mtime1 === mtime2, 'does not rebuild files');

          t.end();
        });
      });
    });
  });

  t.end();
});

function doBuild(filename, done) {
  webpackConfig.entry = entry;

  webpackConfig.output.filename = filename;
  webpackConfig.plugins = [
    new OnlyIfChangedPlugin({
      cacheDirectory: testOutputDir,
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

    waitForIOSettle(done);
  });
}
