'use strict';

// modules
var browserSync = require('browser-sync');
var csso = require('gulp-csso');
var del = require('del');
var fs = require('fs');
var gap = require('gulp-append-prepend');
var gulp = require('gulp');
var argv = require('minimist')(process.argv.slice(2));
var gulpif = require('gulp-if');
var prefix = require('gulp-autoprefixer');
var reload = browserSync.reload;
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');

var packages = require('./package.json');

// configuration
var config = {
    /* Command Line Arguments */
    dev: argv['dev'],
    build: argv['b'], // temporary until build == production
    proxy: argv['p'],
    install: argv['i'],
    
    /* Source file locations */
    src: {
        styles: {
            style_uni: 'interface/themes/style_*.scss',
            style_color: 'interface/themes/colors/*.scss',
            all: 'interface/themes/**/style_*.css',
            all_rtl: 'interface/themes/**/*style_*.css',
        }
    },
    dist: {
        assets: './public/assets/', // vendor assets dir
        fonts: './public/fonts/',
        storybook: '.docs/.out/'
    },
    dest: {
        themes: 'interface/themes'
    }
};

/**
 * Clean up static assets
 * - only deletes the storybook dist
 * TODO make this more strict after CSS is not committed
 */
gulp.task('clean', function () {
    let ignore = "!" + config.dist.storybook+ '.gitignore';
    del.sync([config.dist.storybook + "*", ignore]);
});


/**
 * Parses command line arguments
 */
gulp.task('ingest', function() {
    if (config.dev && typeof config.dev !== "boolean") {
        // allows for custom proxy to be passed into script
        config.proxy = config.dev;
        config.dev = true;
    }
});


/**
 * Will start browser sync and/or watch changes to scss
 * - Runs task(styles) first
 * - Includes hack to dump fontawesome to the storybook dist
 */
gulp.task('sync', ['styles'], function() {
    if (config.proxy) {
        browserSync.init({
            proxy: "127.0.0.1:" + config.proxy
        });
    }

    if (config.dev && !config.build) {
        gulp.watch('inteface/themes/**/*.scss', ['styles']);
    } else {
        // hack to get font awesome files into the .out directory
        gulp.src([
            './public/assets/font-awesome-4-6-3/fonts/**/*.{ttf,woff,eof,svg}'
            ], {base: '../'})
            .pipe(gulp.dest(config.dist.storybook));
    }
});

// definition of header for all compiled css
var autoGeneratedHeader = `
/*! This style sheet was autogenerated using gulp + scss
 *  For usage instructions, see: https://github.com/openemr/openemr/blob/master/interface/README.md
 */
`;


// START style task definitions

/**
 * universal css compilcation
 */
gulp.task('styles:style_uni', function () {
    gulp.src(config.src.styles.style_uni)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(gap.prependText(autoGeneratedHeader))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(gulpif(!config.dev,sourcemaps.write()))
        .pipe(gulp.dest(config.dest.themes))
        .pipe(gulpif(config.build, gulp.dest(config.dist.storybook + config.dest.themes)))
        .pipe(gulpif(config.dev, reload({stream:true})));
});

/**
 * color compilation for colored themes
 */
gulp.task('styles:style_color', function () {
    gulp.src(config.src.styles.style_color)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(gap.prependText(autoGeneratedHeader))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(gulpif(!config.dev,sourcemaps.write()))
        .pipe(gulp.dest(config.dest.themes))
        .pipe(gulpif(config.build, gulp.dest(config.dist.storybook + config.dest.themes)))
        .pipe(gulpif(config.dev, reload({stream:true})));
});

/**
 * append rtl css
 * TODO fix sourcemapping and/or convert to scss import
 */
gulp.task('styles:rtl', function () {
    gulp.src(config.src.styles.all)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(gap.appendFile('interface/themes/rtl.css'))
        .pipe(rename({
            dirname: "",
            prefix:"rtl_"
        }))
        .pipe(gulp.dest(config.dest.themes))
        .pipe(gulpif(config.build, gulp.dest(config.dist.storybook + config.dest.themes)))
        .pipe(gulpif(config.dev, reload({stream:true})));
});

gulp.task('styles:style_list', function () {
    gulp.src(config.src.styles.all_rtl)
        .pipe(require('gulp-filelist')('themeOptions.json', {flatten: true, removeExtensions: true}))
        .pipe(gulp.dest('.storybook'));
});

gulp.task('styles', ['styles:style_uni', 'styles:style_color', 'styles:rtl', 'styles:style_list']);
// END style task definitions


/**
 * Copies node_modules to ./public
 */
gulp.task('install', function() {

    // combine dependencies and napa sources into one object
    var dependencies = packages.dependencies;
    for (var key in packages.napa) {
        if (packages.napa.hasOwnProperty(key)) {
            dependencies[key] = packages.napa[key];
        }
    }

    for (var key in dependencies) {
        // check if the property/key is defined in the object itself, not in parent
        if (dependencies.hasOwnProperty(key)) {
            // only copy dist directory, if it exists
            if (fs.existsSync('node_modules/' + key + '/dist')) {
                gulp.src('node_modules/' + key + '/dist/**/*')
                    .pipe(gulp.dest(config.dist.assets + key + '/dist'));
            } else {
                gulp.src('node_modules/' + key + '/**/*')
                    .pipe(gulp.dest(config.dist.assets + key));
            }
        }
    }
});

 /**
 * Default config
 * - runs by default when `gulp` is called from CLI
 */
if (config.install) {
    gulp.task('default', [ 'install' ]);
} else if (config.dev && !config.build) {
    gulp.task('default', [ 'ingest', 'sync' ]);
} else {
    gulp.task('default', function (callback) {
        runSequence('clean', ['sync'], callback)
    });
}

