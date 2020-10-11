var path = require('path')
var testUtils = require('./testUtils')
var entry = path.join(testUtils.projectRoot, 'fixtures/test-module/a.js')
var OnlyIfChangedPlugin = require('../')

module.exports = {
    entry: entry,
    mode: 'production',
    output: {
        path: testUtils.testOutputDir,
        filename: 'example-bundle.js',
    },
    plugins: [
        new OnlyIfChangedPlugin({
            cacheDirectory: testUtils.testOutputDir,
            cacheIdentifier: 'cache',
        }),
    ],
}
