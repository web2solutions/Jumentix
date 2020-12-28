'use strict'

/*
    Configuration file for MQ
*/
export default {
  development: {
    sync: false,
    apiURL: 'https://wp.parentfinder.com/wp-json/',
    authURL: 'https://wp.parentfinder.com/wp-json/jwt-auth/v1/token',
    clientId: 'secret',
    clientSecret:
      'xxxxxxxxxxxxx',
    tokenExpireDays: 7
  },
  CI: {
    sync: false,
    apiURL: 'https://wp.parentfinder.com/wp-json/',
    authURL: 'https://wp.parentfinder.com/wp-json/jwt-auth/v1/token',
    clientId: 'secret',
    clientSecret:
      'xxxxxxxxxxxxx',
    tokenExpireDays: 7
  },
  travis: {
    sync: false,
    apiURL: 'https://wp.parentfinder.com/wp-json/',
    authURL: 'https://wp.parentfinder.com/wp-json/jwt-auth/v1/token',
    clientId: 'secret',
    clientSecret:
      'xxxxxxxxxxxxx',
    tokenExpireDays: 7
  },
  test: {
    sync: false,
    apiURL: 'https://wp.parentfinder.com/wp-json/',
    authURL: 'https://wp.parentfinder.com/wp-json/jwt-auth/v1/token',
    clientId: 'secret',
    clientSecret:
      'xxxxxxxxxxxxx',
    tokenExpireDays: 7
  },
  testMac: {
    sync: false,
    apiURL: 'https://wp.parentfinder.com/wp-json/',
    authURL: 'https://wp.parentfinder.com/wp-json/jwt-auth/v1/token',
    clientId: 'secret',
    clientSecret:
      'xxxxxxxxxxxxx',
    tokenExpireDays: 7
  },
  production: {
    sync: false,
    apiURL: 'https://wp.parentfinder.com/wp-json/',
    authURL: 'https://wp.parentfinder.com/wp-json/jwt-auth/v1/token',
    clientId: 'secret',
    clientSecret:
      'xxxxxxxxxxxxx',
    tokenExpireDays: 7
  }
}
