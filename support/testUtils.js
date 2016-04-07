var path = require('path');
var execFile = require('child_process').execFile;
var rimraf = require('rimraf');

var projectRoot = path.resolve(__dirname, '../');

var testOutputDir = path.join(projectRoot, 'tmp/test');

// mtime resolution can be 1-2s depending on OS
// should wait that long between test builds
// TODO: investigate this
var minMtimeResolution = 0;

function waitForIOSettle(done) {
  setTimeout(done, minMtimeResolution);
}

var fixturesDir = path.join(projectRoot, 'fixtures');

function cleanupTestOutputDir(done) {
  rimraf(testOutputDir, {disableGlob: true}, (rmRfErr) => {
    if (rmRfErr) done(rmRfErr);

    execFile('mkdir', ['-p', testOutputDir], (mkdirErr) => {
      if (mkdirErr) done(mkdirErr);
      done();
    });
  });
}

module.exports = {
  waitForIOSettle,
  minMtimeResolution,
  testOutputDir,
  projectRoot,
  cleanupTestOutputDir,
  fixturesDir,
};
