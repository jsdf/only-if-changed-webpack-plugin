var fs = require('fs')
var path = require('path')
var execFile = require('child_process').execFile
var rimraf = require('rimraf')

var projectRoot = path.resolve(__dirname, '../')

var testOutputDir = path.join(projectRoot, 'tmp/test')

// mtime resolution can be 1-2s depending on OS
// should wait that long between test builds
// TODO: investigate this
var MTIME_RESOLUTION = 300

// webpack 'done' event can be called before write has flushed all data
var WRITE_CLOSE_TIME = 300

function waitForIOSettle(done) {
    setTimeout(done, MTIME_RESOLUTION + WRITE_CLOSE_TIME)
}

var fixturesDir = path.join(projectRoot, 'fixtures')

function cleanupTestOutputDir(done) {
    rimraf(testOutputDir, {disableGlob: true}, (rmRfErr) => {
        if (rmRfErr) done(rmRfErr)

        execFile('mkdir', ['-p', testOutputDir], (mkdirErr) => {
            if (mkdirErr) done(mkdirErr)
            done()
        })
    })
}

// wait this long for file to appear
var READ_FILE_TIMEOUT = 2000

function readFile(filepath) {
    var start = Date.now()
    var contents = null
    var outOfTime = false
    while (!outOfTime) {
        try {
            contents = fs.readFileSync(filepath, {encoding: 'utf8'})
        } catch (err) {
            // file doesn't exist yet
        }
        outOfTime = Date.now() > start + READ_FILE_TIMEOUT
    }

    if (contents == null) {
        throw new Error('Timeout waiting for file read')
    }
    return contents
}

function writeFile(filepath, content, unixtime) {
    fs.writeFileSync(filepath, content, {encoding: 'utf8'})

    if (typeof unixtime !== 'undefined') {
        fs.utimesSync(filepath, unixtime, unixtime)
    }
}

module.exports = {
    waitForIOSettle,
    testOutputDir,
    projectRoot,
    cleanupTestOutputDir,
    readFile,
    writeFile,
    fixturesDir,
}
