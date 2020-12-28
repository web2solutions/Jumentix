'use strict'

/*
    Configuration file for MQ
*/
// import config from './'
// const env = process.env.NODE_ENV || 'development';
// const conf = config[env]

export default {
  development: {
    clientID:
      '796429734244-ooj5qst2acfihdjd5etfvk6o1e2qck4i.apps.googleusercontent.com',
    clientSecret: 'xxxxxxxxxxxxx',
    callbackURL: '/api/Agency/YoutubeCallback'
  },
  CI: {
    clientID:
      '796429734244-ooj5qst2acfihdjd5etfvk6o1e2qck4i.apps.googleusercontent.com',
    clientSecret: 'xxxxxxxxxxxxx',
    callbackURL: '/api/Agency/YoutubeCallback'
  },
  travis: {
    clientID:
      '796429734244-ooj5qst2acfihdjd5etfvk6o1e2qck4i.apps.googleusercontent.com',
    clientSecret: 'xxxxxxxxxxxxx',
    callbackURL: '/api/Agency/YoutubeCallback'
  },
  test: {
    clientID:
      '796429734244-ooj5qst2acfihdjd5etfvk6o1e2qck4i.apps.googleusercontent.com',
    clientSecret: 'xxxxxxxxxxxxx',
    callbackURL: '/api/Agency/YoutubeCallback'
  },
  testMac: {
    clientID:
      '796429734244-ooj5qst2acfihdjd5etfvk6o1e2qck4i.apps.googleusercontent.com',
    clientSecret: 'xxxxxxxxxxxxx',
    callbackURL: '/api/Agency/YoutubeCallback'
  },
  production: {
    clientID:
      '796429734244-ooj5qst2acfihdjd5etfvk6o1e2qck4i.apps.googleusercontent.com',
    clientSecret: 'xxxxxxxxxxxxx',
    callbackURL: '/api/Agency/YoutubeCallback'
  }
}

// module.exports.config = config;
