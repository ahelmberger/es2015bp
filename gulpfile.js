"use strict";

var fs                 = require("fs");
var url                = require("url");
var path               = require("path");
var gulp               = require("gulp");
var less               = require("less");
var jspm               = require("jspm");
var karma              = require("karma");
var rimraf             = require("rimraf");
var runSequence        = require("run-sequence");
var browserSync        = require("browser-sync");
var CleanCssPlugin     = require("less-plugin-clean-css");
var AutoPrefixPlugin   = require("less-plugin-autoprefix");
var historyApiFallback = require("connect-history-api-fallback");
var $                  = require("gulp-load-plugins")();

var supportedBrowsers  = ["last 3 versions", "last 3 BlackBerry versions", "last 3 Android versions"];
var autoPrefix         = new AutoPrefixPlugin({ browsers: supportedBrowsers });
var cleanCss           = new CleanCssPlugin({ advanced: true });

gulp.task("clean", function (done) {
  rimraf("dist", { maxBusyTries: 5 }, done);
});

gulp.task("lint", function () {
  return gulp.src(["*.js", "app/!(jspm_packages)/**/*.js"])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.if(shouldExitOnFailure, $.eslint.failAfterError()));
});

gulp.task("build:styles", function () {
  return gulp.src("app/main.less")
    .pipe($.sourcemaps.init())
    .pipe($.less({ plugins: [cleanCss, autoPrefix] }))
    .pipe($.sourcemaps.write(".", { includeContent: false, sourceRoot: "." }))
    .pipe(gulp.dest("dist"));
});

gulp.task("build:scripts", function (done) {
  jspm.setPackagePath(".");
  jspm.bundleSFX("main", "dist/main.js", { minify: true, mangle: true, sourceMaps: true, lowResSourceMaps: false }).then(done, done);
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
  ["dist/main.js.map", "dist/main.css.map"].forEach(function (sourceMapPath) {
    patchSourceMap(sourceMapPath, "app", "/sources/");
  });
  done();
});

gulp.task("test", function (done) {
  runKarma(done, true, ["PhantomJS"]);
});

gulp.task("test:debug", function (done) {
  runKarma(done, false, ["Chrome"]);
});

gulp.task("lint-and-test", function (done) {
  runSequence("lint", "test", done);
});

gulp.task("reload-styles", function () {
  browserSync.reload("main.less");
});

gulp.task("serve", function () {
  var lessFallbackOptions = { root: "app", plugins: [cleanCss, autoPrefix], sourceMap: true };
  startBrowserSync("app", [cssToLessFallback(lessFallbackOptions), historyApiFallback]);
  gulp.watch(["*.js"], ["lint"]);
  gulp.watch(["app/**/*.js"], ["lint-and-test"]);
  gulp.watch(["app/**/*.less"], ["reload-styles"]);
});

gulp.task("serve:dist", function () {
  startBrowserSync("dist", [historyApiFallback]);
});

gulp.task("default", ["serve"]);

function patchSourceMap(sourceMapPath, baseDir, sourceRoot, file) {
  var sourceMap = JSON.parse(fs.readFileSync(sourceMapPath, "utf-8"));
  sourceMap.sourcesContent = sourceMap.sources.map(function (source) {
    return fs.readFileSync(path.resolve(path.dirname(sourceMapPath), source), "utf-8");
  });
  sourceMap.sources = sourceMap.sources.map(function (source) {
    return path.relative(path.resolve(baseDir), path.resolve(path.dirname(sourceMapPath), source));
  });
  sourceMap.sourceRoot = sourceRoot || "/";
  sourceMap.file = file || path.basename(sourceMapPath).replace(/\.map$/, "");
  fs.writeFileSync(sourceMapPath, JSON.stringify(sourceMap));
}

function cssToLessFallback(options) {
  var root = path.resolve(options.root);
  return function (req, res, next) {
    var requestedPath = url.parse(req.url).pathname;
    if (requestedPath.match(/\.css$/)) {
      var cssFile = path.resolve(path.join(root, requestedPath));
      var lessFile = path.resolve(path.join(root, requestedPath.replace(/\.css$/, ".less")));
      if (!fs.existsSync(cssFile) && fs.existsSync(lessFile)) {
        var content = fs.readFileSync(lessFile).toString();
        var lessOptions = { filename: lessFile, plugins: options.plugins };
        if (options.sourceMap) {
          lessOptions.sourceMap = { sourceMapFileInline: true, sourceMapBasepath: path.dirname(lessFile) };
        }
        return less.render(content, lessOptions).then(function (output) {
          res.setHeader("Content-Type", "text/css");
          res.end(output.css);
        });
      }
    }
    next();
  };
}

function runKarma(done, singleRun, browsers) {
  karma.server.start({
    configFile: path.resolve("karma.conf.js"),
    singleRun: singleRun,
    browsers: browsers || ["PhantomJS"]
  }, function (failedTests) {
    if (failedTests && shouldExitOnFailure()) {
      throw new Error("Terminating process due to failing tests.");
    }
    done();
  });
}

function startBrowserSync(baseDir, middleware) {
  browserSync({
    files: [baseDir + "/**"],
    server: { baseDir: baseDir, middleware: middleware },
    startPath: "/",
    browser: "default"
  });
}

function shouldExitOnFailure() {
  return !browserSync.active;
}
