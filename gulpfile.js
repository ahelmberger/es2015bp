"use strict";

var fs                 = require("fs");
var url                = require("url");
var path               = require("path");
var gulp               = require("gulp");
var less               = require("less");
var jspm               = require("jspm");
var rimraf             = require("rimraf");
var runSequence        = require("run-sequence");
var browserSync        = require("browser-sync");
var CleanCssPlugin     = require("less-plugin-clean-css");
var AutoPrefixPlugin   = require("less-plugin-autoprefix");
var historyApiFallback = require("connect-history-api-fallback");
var tools              = require("require-dir")("build", { camelcase: true });
var $                  = require("gulp-load-plugins")();

var supportedBrowsers  = ["last 3 versions", "last 3 BlackBerry versions", "last 3 Android versions"];
var autoPrefix         = new AutoPrefixPlugin({ browsers: supportedBrowsers });
var cleanCss           = new CleanCssPlugin({ advanced: true });
var exitOnError        = true;

gulp.task("clean", function (done) {
  rimraf("dist", { maxBusyTries: 5 }, done);
});

gulp.task("lint", function () {
  return gulp.src(["*.js", "app/!(jspm_packages)/**/*.js"])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.if(exitOnError, $.eslint.failAfterError()));
});

gulp.task("build:styles", function () {
  return gulp.src("app/main.less")
    .pipe($.sourcemaps.init())
    .pipe($.less({ plugins: [cleanCss, autoPrefix] }))
    .pipe($.sourcemaps.write(".", { includeContent: false, sourceRoot: "." }))
    .pipe(gulp.dest("dist"));
});

gulp.task("build:scripts", function (done) {
  var bundleOptions = { minify: true, mangle: true, sourceMaps: true, lowResSourceMaps: false };
  jspm.setPackagePath(".");
  jspm.bundleSFX("main", "dist/main.js", bundleOptions).then(done, done);
});

gulp.task("build:html", function () {
  return gulp.src("app/index.html")
    .pipe($.htmlReplace({ css: "/main.css", js: "/main.js" }))
    .pipe($.minifyHtml({ empty: true, spare: true, quotes: true }))
    .pipe(gulp.dest("dist"));
});

gulp.task("build", function (done) {
  runSequence("clean", "lint", "test", ["build:styles", "build:scripts", "build:html"], "sanitize-sourcemaps", done);
});

gulp.task("sanitize-sourcemaps", function (done) {
  tools.sanitizeSourceMaps("dist/*.map", "app", "/sources/", done);
});

gulp.task("serve", function () {
  var lessFallbackOptions = { root: "app", plugins: [cleanCss, autoPrefix], sourceMap: true };
  tools.startBrowserSync("app", [cssToLessFallback(lessFallbackOptions), historyApiFallback]);
});

gulp.task("serve:dist", function () {
  tools.startBrowserSync("dist", [historyApiFallback]);
});

gulp.task("test", function (done) {
  var options = { configFile: path.resolve("karma.conf.js"), singleRun: true, browsers: ["PhantomJS"] };
  tools.runKarma(options, exitOnError, done);
});

gulp.task("test:debug", function (done) {
  var options = { configFile: path.resolve("karma.conf.js"), singleRun: false, browsers: ["Chrome"] };
  tools.runKarma(options, exitOnError, done);
});

gulp.task("lint-and-test", function (done) {
  runSequence("lint", "test", done);
});

gulp.task("reload-styles", function () {
  browserSync.reload("main.css");
});

gulp.task("watch", ["serve"], function () {
  exitOnError = false;
  gulp.watch(["*.js", "build/*.js"], ["lint"]);
  gulp.watch(["app/**/*.js"], ["lint-and-test"]);
  gulp.watch(["app/**/*.less"], ["reload-styles"]);
});

gulp.task("default", ["watch"]);

function cssToLessFallback(options) {
  var root = path.resolve(options.root);
  return function (req, res, next) {
    var requestedPath = url.parse(req.url).pathname;
    if (requestedPath.match(/\.css$/)) {
      var cssFile = path.resolve(path.join(root, requestedPath));
      var lessFile = path.resolve(path.join(root, requestedPath.replace(/\.css$/, '.less')));
      if (!fs.existsSync(cssFile) && fs.existsSync(lessFile)) {
        var content = fs.readFileSync(lessFile).toString();
        var lessOptions = { filename: lessFile, plugins: options.plugins };
        if (options.sourceMap) {
          lessOptions.sourceMap = { sourceMapFileInline: true, sourceMapBasepath: path.dirname(lessFile) };
        }
        return less.render(content, lessOptions)
          .then(function (output) {
            res.setHeader('Content-Type', 'text/css');
            res.end(output.css);
            next();
          })
          .catch(function (error) {
            res.setHeader('Content-Type', 'text/css');
            res.end(createCssErrorMessage(error));
            next();
          });
      }
    }
    next();
  };
}

function createCssErrorMessage(error) {
  var rules = {
    'display'    : 'block',
    'z-index'    : '1000',
    'position'   : 'fixed',
    'top'        : '0',
    'left'       : '0',
    'right'      : '0',
    'font-size'  : '.9em',
    'padding'    : '1.5em 1em 1.5em 4.5em',
    'color'      : 'white',
    'background' : 'linear-gradient(#DF4F5E, #CE3741)',
    'border'     : '1px solid #C64F4B',
    'box-shadow' : 'inset 0 1px 0 #EB8A93, 0 0 .3em rgba(0, 0, 0, .5)',
    'white-space': 'pre',
    'font-family': 'monospace',
    'text-shadow': '0 1px #A82734',
    'content'    : '"' + error.toString().replace(/"/g, '\\"') + '"'
  };
  var combinedRules = Object.keys(rules).map(function (key) {
    return key + ':' + rules[key];
  });
  return 'html::before{' + combinedRules.join(';') + '}';
}
