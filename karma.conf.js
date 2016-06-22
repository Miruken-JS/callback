var isparta = require('isparta');
var paths = require('./build/paths');
var compilerOptions = require('./build/babel-options');

module.exports = function(config) {
    config.set({
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',
        
        frameworks: ['jspm', 'mocha', 'chai'],

        plugins: ['karma-jspm', 'karma-mocha', 'karma-chai',
                  'karma-babel-preprocessor', 'karma-coverage',
                  'karma-chrome-launcher'],

        systemjs: {
            configFile: 'config.js',

            files: [paths.tests],
            serveFiles: [paths.source],

            // SystemJS configuration specifically for tests, added after your config file.
            // Good for adding test libraries and mock modules
            config: {
                paths: {
                    'babel': 'node_modules/babel-core/lib/api/browser.js',
                    'systemjs': 'node_modules/systemjs/dist/system.js',
                },
                transpiler: 'babel'
            }
        },
        
        jspm: {
            loadFiles: [paths.tests],
            serveFiles: [paths.source],
            //paths: {
            //    "miruken-core": "node_modules/miruken-core/dist/miruken-core.js"
            //}
        },
        
        files: [],
        
        preprocessors: {
            [paths.tests]: ['babel'],
            [paths.source]: ['babel']
        },

        babelPreprocessor: {
            options: {
                sourceMap: 'inline',
                presets: [ 'es2015'],
                plugins: []
            }
        },

        reporters: ['coverage', 'progress'],
        
        coverageReporter: {
            instrumenters: {
                isparta: isparta
            },
            
            instrumenter: {
                [paths.source]: 'isparta'
            },
            
            dir: 'build/reports/coverage/',
            
            reporters: [{
                type: 'text-summary'
            }, {
                type: 'html',
                subdir: 'html'
            }, {
                type: 'lcovonly',
                subdir: 'lcov',
                file: 'report-lcovonly.txt'
            }]
        },
        
        port: 9876,
        
        colors: true,
        
        logLevel: config.LOG_INFO,
        
        autoWatch: true,
        
        browsers: ['Chrome'],
        
        singleRun: false
    });
};
