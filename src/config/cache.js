'use strict'

/*
    Configuration file for cache / Redis
*/
// import _config from './'

// const env = process.env.NODE_ENV || 'development'
// pck = require('../../package.json'),
const config = {
  development: {
    isCached: false,
    isCachedBasedOnUser: true,
    cacheExpiresIn: 1 * (60 * 60) // hours - default 3600 seconds, one hour
  },
  CI: {
    isCached: false,
    isCachedBasedOnUser: true,
    cacheExpiresIn: 1 * (60 * 60) // hours - default 3600 seconds, one hour
  },
  travis: {
    isCached: false,
    isCachedBasedOnUser: true,
    cacheExpiresIn: 1 * (60 * 60) // hours - default 3600 seconds, one hour
  },
  test: {
    isCached: false,
    isCachedBasedOnUser: true,
    cacheExpiresIn: 1 * (60 * 60) // hours - default 3600 seconds, one hour
  },
  testMac: {
    isCached: false,
    isCachedBasedOnUser: true,
    cacheExpiresIn: 1 * (60 * 60) // hours - default 3600 seconds, one hour
  },
  production: {
    isCached: false,
    isCachedBasedOnUser: true,
    cacheExpiresIn: 1 * (60 * 60) // hours - default 3600 seconds, one hour
  }
}
export default config
