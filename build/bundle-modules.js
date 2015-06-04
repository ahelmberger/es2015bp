'use strict';

var jspm              = require('jspm');
var htmlMinifier      = require('html-minifier');
var sanitizeSourceMap = require('./sanitize-source-map');

module.exports = function (options) {
  var bundleOptions = {
    minify: options.minify,
    mangle: options.mangle,
    sourceMaps: true,
    lowResSourceMaps: false
  };

  jspm.setPackagePath(options.packagePath);

  var builder = new jspm.Builder();
  configureLoaderToMinifyHtml(builder.loader, options.htmlmin);
  return builder.buildSFX(options.rootModule, options.outputPath, bundleOptions).then(function () {
    sanitizeSourceMap(options.outputPath + '.map', options.base, options.sourceRoot);
  });
};

function configureLoaderToMinifyHtml(loader, htmlminOptions) {
  var originalTranslate = loader.translate;
  loader.translate = function (load) {
    if (load.address.match(/\.html$/)) {
      load.source = htmlMinifier.minify(load.source, htmlminOptions);
    }
    return originalTranslate(load);
  };
}
