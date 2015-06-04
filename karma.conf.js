'use strict';

module.exports = function (config) {

  config.set({
    basePath: 'app',
    frameworks: ['jspm', 'jasmine', 'phantomjs-shim'],
    files: [],
    jspm: {
      serveFiles: ['**/*'],
      loadFiles: ['polyfills.js', '**/*.specs.js']
    },
    proxies: {
      '/base/': '/base/app/'
    },
    exclude: [],
    preprocessors: {},
    reporters: ['spec'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['PhantomJS'],
    singleRun: false
  });

};
