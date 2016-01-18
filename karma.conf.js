// Karma configuration
// Generated on Wed Aug 12 2015 20:08:22 GMT+0200 (CEST)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    plugins: [
      'karma-phantomjs-launcher',
      'karma-firefox-launcher',
      'karma-proclaim',
      'karma-mocha',
      'karma-sprockets-mincer'
    ],

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: [
      'sprockets-mincer',
      'mocha',
      'proclaim'
    ],

    // list of files / patterns to load in the browser
    files: [
      'test/javascript/iframe.html',
    ],

    // list of files to exclude
    exclude: [
    ],

    sprocketsPaths: [
      'lib/assets/javascripts',
      'test/javascript'
    ],

    sprocketsBundles: [
      {
        pattern: 'application.js',
        included: false
      },
      'test.js'
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
    },

    // coffeePreprocessor: {
    //   // options passed to the coffee compiler
    //   options: {
    //     bare: true,
    //     sourceMap: false
    //   },
    //   // transforming the filenames
    //   transformPath: function(path) {
    //     return path.replace(/\.coffee$/, '.js');
    //   }
    // },

    client: {
      mocha: {
        reporter: 'html', // change Karma's debug.html to the mocha web reporter
        ui: 'tdd',
        timeout: 3000
      }
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['PhantomJS', 'Firefox'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false
  });
};
