'use strict'
import fs from 'fs';
import chalk from 'chalk';
import gulp from 'gulp';
import babel from 'gulp-babel';
import rename from 'gulp-rename';
import clean from 'gulp-rimraf';
import minify from 'gulp-minifier';
import jeditor from "gulp-json-editor";
import runSequence from 'run-sequence';
import nodemon from 'gulp-nodemon'
import replace from 'gulp-replace'
const pkg = require('./package.json')

const root = './';
const dist = './dist';
const pm2_simple = `pm2.simple.config.js`;
const pm2_cluster = `pm2.cluster.config.js`;


gulp.task('build', () => {
    // Sequence
    runSequence('build-clean', 'build-server', 'copy-assets');
});

gulp.task('build-clean', () => {
    // Remove files dist, but ignore assets
    return gulp.src([
        `${dist}`
    ], {
        read: false
    }).pipe(clean({
        force: true
    }));
});


gulp.task('build-server', () =>
    gulp.src(['src/**/*.js'])
    .pipe(babel())
    .pipe(gulp.dest('dist/'))
)

gulp.task('copy-assets', () => {
    gulp.src(['src/lib/templates/**/*.*']).pipe(gulp.dest('dist/lib/templates/'));
    gulp.src(['src/lib/api/swagger/**/*.*']).pipe(gulp.dest('dist/lib/api/swagger/'));
    gulp.src(['src/lib/auth/swagger/**/*.*']).pipe(gulp.dest('dist/lib/auth/swagger/'));
    gulp.src(['src/config/*.json']).pipe(gulp.dest('dist/config/'));

    gulp.src("package.json").pipe(jeditor((json) => {
        //delete json.devDependencies;
        json.build = parseInt(json.build) + 1
        return json;
    })).pipe(gulp.dest( root ));

    gulp.src("package.json").pipe(jeditor((json) => {
        delete json.devDependencies;
        delete json.dependencies;
        return json;
    })).pipe(gulp.dest( dist ));


    setTimeout(() => console.log(chalk.greenBright('\n---------\n'+pkg.name+'\n\nversion: '+pkg.version+'\n\nbuild: '+pkg.build+'\n\nBuild success!\n---------\n')), 500);
});

gulp.task('watch', ['build'], () => {
    gulp.watch(['src/**/*.*'], ['build-server'])
    gulp.start('run')
})

gulp.task('run', () => {
    nodemon({
        delay: 10,
        script: 'dist/worker.js',
        // args: ["config.json"],
        ext: 'js',
        watch: 'src'
    })
})

gulp.task('default', ['build', 'run'])
