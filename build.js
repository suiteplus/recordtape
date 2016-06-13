/* eslint-env es6 */
var ts = require('gulp-typescript')
var scripts = require('gulp-scripts')
var gulp = require('gulp')
var through = require('through2')

function run() {
    return Promise.resolve()
        .then( compileTypescript )
        .then( package )
};
run();


function streamToPromise(stream) {
    return new Promise( (resolve, reject) => {
        var finished
        stream.on('end', function() {
            if (!finished) resolve()
            finished = true
        })
        .on('error', function() {
            console.log('stream error')
            reject()
        })
    })
}


function compileTypescript() {
    console.log('compile typescript')
    var s = gulp.src(['./src/*.ts'])
        .pipe(ts({
            "module": "commonjs" ,
            "target" : "es5"
        }))
        .js
        .pipe(gulp.dest('intermediate'))

    return streamToPromise(s)
}


function package() {
    console.log('package')
    var s = gulp.src('./intermediate/recordtape.js')
        .pipe(scripts.package())
        .pipe(scripts.addGlobals())
        .pipe(gulp.dest('dist'))
    return streamToPromise(s)
}