'use strict';

var path               = require('path');
var gulp               = require('gulp');
var rimraf             = require('rimraf');
var Promise            = require('promise');
var browserSync        = require('browser-sync');
var runSequence        = require('run-sequence');
var historyApiFallback = require('connect-history-api-fallback');
var tools              = require('require-dir')('build', { camelcase: true });
var $                  = require('gulp-load-plugins')();

var exitOnError = true;

var buildOptions = {
  version: require('./package.json').version,
  autoprefixer: {
    browsers: ['last 3 versions', 'last 3 BlackBerry versions', 'last 3 Android versions']
  },
  csswring: {
    removeAllComments: true
  },
  htmlmin: {
    removeComments: true,
    ignoreCustomComments: [],
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeAttributeQuotes: true,
    useShortDoctype: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    removeOptionalTags: true,
    caseSensitive: true
  }
};

gulp.task('clean', function (done) {
  ['.tmp', 'dist'].forEach(function (dir) {
    rimraf.sync(dir, { maxBusyTries: 5 });
  });
  done();
});

gulp.task('lint', function () {
  return gulp.src(['*.js', 'build/**/*.js', 'app/**/*.js', '!app/jspm_packages/**', '!app/config.js'])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.if(exitOnError, $.eslint.failAfterError()));
});

gulp.task('scripts', function (done) {
  browserSync.reload();
  runSequence('lint', 'test', done);
});

gulp.task('templates', function () {
  browserSync.reload();
});

gulp.task('styles', function (done) {
  tools.compileLess({
    from: 'app/main.less',
    to: '.tmp/main.css',
    base: 'app',
    embedErrors: true,
    csswring: buildOptions.csswring,
    autoprefixer: buildOptions.autoprefixer
  }).then(function () {
    browserSync.reload('main.css');
  }).then(done, done);
});

gulp.task('build:scripts', function (done) {
  var bundlePolyfills = tools.bundleModules({
    packagePath: '.',
    rootModule: 'polyfills',
    outputPath: 'dist/polyfills.js',
    base: 'app',
    sourceRoot: '/sources/',
    minify: true,
    mangle: true,
    htmlmin: buildOptions.htmlmin
  });
  var bundleMain = tools.bundleModules({
    packagePath: '.',
    rootModule: 'main',
    outputPath: 'dist/main.js',
    base: 'app',
    sourceRoot: '/sources/',
    minify: true,
    mangle: true,
    htmlmin: buildOptions.htmlmin
  });
  Promise.all([bundlePolyfills, bundleMain]).then(done.bind(undefined, undefined), done);
});

gulp.task('build:styles', function (done) {
  tools.compileLess({
    from: 'app/main.less',
    to: 'dist/main.css',
    base: 'app',
    sourceRoot: '/sources/',
    csswring: buildOptions.csswring,
    autoprefixer: buildOptions.autoprefixer
  }).then(done, done);
});

gulp.task('build:html', function () {
  var query = '?v=' + buildOptions.version;
  return gulp.src('app/index.html')
    .pipe($.htmlReplace({
      css: { src: '/main.css' + query, tpl: '<link rel="stylesheet" href="%s">' },
      js: { src: ['/polyfills.js' + query, '/settings.js' + query, '/main.js' + query], tpl: '<script src="%s"></script>' }
    }))
    .pipe($.htmlmin(buildOptions.htmlmin))
    .pipe(gulp.dest('dist'));
});

gulp.task('build:assets', function () {
  return gulp.src(['app/**/*.{ico,txt,png,svg,gif,jpg,config}', '!app/jspm_packages/**'])
    .pipe(gulp.dest('dist'));
});

gulp.task('build', function (done) {
  runSequence('clean', 'lint', 'test', ['build:styles', 'build:scripts', 'build:html', 'build:assets'], done);
});

gulp.task('serve', ['styles'], function () {
  tools.startBrowserSync(['.tmp', 'app'], [historyApiFallback()]);
});

gulp.task('serve:dist', function () {
  tools.startBrowserSync('dist', [historyApiFallback()]);
});

gulp.task('test', function (done) {
  var options = { configFile: path.resolve('karma.conf.js'), singleRun: true, browsers: ['PhantomJS'] };
  tools.runKarma(options, exitOnError, done);
});

gulp.task('test:debug', function (done) {
  var options = { configFile: path.resolve('karma.conf.js'), singleRun: false, browsers: ['Chrome'] };
  tools.runKarma(options, exitOnError, done);
});

gulp.task('watch', ['serve'], function () {
  exitOnError = false;
  gulp.watch(['*.js', 'build/*.js'], ['lint']);
  gulp.watch(['app/**/*.js'], ['scripts']);
  gulp.watch(['app/**/*.less'], ['styles']);
  gulp.watch(['app/**/*.html', '!index.html'], ['templates']);
});

gulp.task('default', ['watch']);
