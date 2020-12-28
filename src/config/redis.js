'use strict'

/*
    Configuration file for Redis
*/
// import _config from './'

// const env = process.env.NODE_ENV || 'development'
// pck = require('../../package.json'),
const config = {
  development: {
    host: 'localhost', // The redis's server ip
    port: '6379',
    // password: 'LotsOfPlaces2G0',
    db: 2, // _config[env].dbName,
    // prefix:  _config[env].dbName,
    secret: 'LotsOfPlaces2G0', // secret key for Tokens!
    multiple: true, // single or multiple sessions by user
    kea: false, // Enable notify-keyspace-events KEA
    retry_strategy: function (options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection')
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted')
      }
      if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined
      }
      // reconnect after
      return Math.min(options.attempt * 100, 3000)
    }
  },
  CI: {
    host: 'localhost', // The redis's server ip
    port: '6379',
    // password: 'LotsOfPlaces2G0',
    db: 1, // _config[env].dbName,
    // prefix:  _config[env].dbName,
    secret: 'LotsOfPlaces2G0', // secret key for Tokens!
    multiple: true, // single or multiple sessions by user
    kea: false, // Enable notify-keyspace-events KEA
    retry_strategy: function (options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection')
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted')
      }
      if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined
      }
      // reconnect after
      return Math.min(options.attempt * 100, 3000)
    }
  },
  travis: {
    host: 'localhost', // The redis's server ip
    port: '6379',
    // password: 'LotsOfPlaces2G0',
    db: 1, // _config[env].dbName,
    // prefix:  _config[env].dbName,
    secret: 'LotsOfPlaces2G0', // secret key for Tokens!
    multiple: true, // single or multiple sessions by user
    kea: false, // Enable notify-keyspace-events KEA
    retry_strategy: function (options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection')
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted')
      }
      if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined
      }
      // reconnect after
      return Math.min(options.attempt * 100, 3000)
    }
  },
  test: {
    host: 'localhost', // The redis's server ip
    port: '6379',
    // password: 'LotsOfPlaces2G0',
    db: 1, // _config[env].dbName
    // prefix:  _config[env].dbName,
    secret: 'LotsOfPlaces2G0', // secret key for Tokens!
    multiple: true, // single or multiple sessions by user
    kea: false, // Enable notify-keyspace-events KEA
    retry_strategy: function (options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection')
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted')
      }
      if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined
      }
      // reconnect after
      return Math.min(options.attempt * 100, 3000)
    }
  },
  testMac: {
    host: 'localhost', // The redis's server ip
    port: '6379',
    // password: 'LotsOfPlaces2G0',
    db: 4, // _config[env].dbName,
    // prefix:  _config[env].dbName,
    secret: 'LotsOfPlaces2G0', // secret key for Tokens!
    multiple: true, // single or multiple sessions by user
    kea: false, // Enable notify-keyspace-events KEA
    retry_strategy: function (options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection')
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted')
      }
      if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined
      }
      // reconnect after
      return Math.min(options.attempt * 100, 3000)
    }
  },
  production: {
    host: '192.168.1.68', // The redis's server ip
    port: '6379',
    // password: 'LotsOfPlaces2G0',
    db: 1, // _config[env].dbName
    // prefix:  _config[env].dbName,
    secret: 'LotsOfPlaces2G0', // secret key for Tokens!
    multiple: true, // single or multiple sessions by user
    kea: false, // Enable notify-keyspace-events KEA
    retry_strategy: function (options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection')
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted')
      }
      if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined
      }
      // reconnect after
      return Math.min(options.attempt * 100, 3000)
    }
  }
}
export default config
