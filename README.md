
# only-if-changed-webpack-plugin

Webpack plugin to only run build if dependent files have changed

## Example

```js
var path = require('path');
var OnlyIfChangedPlugin = require('only-if-changed-webpack-plugin');

var opts = {
  rootDir: process.cwd(),
  devBuild: process.env.NODE_ENV !== 'production',
};

module.exports = {
  output: {
    filename: 'bundle.js',
    path: path.join(opts.rootDir, 'build'),
    pathinfo: opts.devBuild,
  },
  plugins: [
    new OnlyIfChangedPlugin({
      cacheDirectory: path.join(opts.rootDir, 'tmp/cache'),
      cacheIdentifier: opts, // all variable opts/environment should be used in cache key
    })
  ],
};
```

After a successful build, all subsequent builds will skip compiling and emitting 
assets unless an input file dependency or output asset of the build has been 
modified or deleted.

### See also

- [cached-loader](https://github.com/jsdf/cached-loader) – Adds persistent on-disk caching to webpack loaders

