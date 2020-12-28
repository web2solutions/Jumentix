'use strict'

/*
    Configuration file for MQ
*/
// import config from './'
// const env = process.env.NODE_ENV || 'development',
// conf = config[env]

export default {
  development: {
    sync: false,
    authURL: 'https://crm.cairsolutions.com/api/oauth/access_token',
    apiURL: 'https://crm.cairsolutions.com/',
    clientId: '5632e8f0-9d30-2bc2-ff94-5d4390c099ee',
    secretKey: 'xxxxxxxxxxxxx',
    accessToken:
      'd1b58cfb23327c447347304020a99feb86257c64e18baa342d17824daade2bb5'
  },
  CI: {
    sync: false,
    authURL: 'https://crm.cairsolutions.com/api/oauth/access_token',
    apiURL: 'https://crm.cairsolutions.com/',
    clientId: '5632e8f0-9d30-2bc2-ff94-5d4390c099ee',
    secretKey: 'xxxxxxxxxxxxx',
    accessToken:
      'd1b58cfb23327c447347304020a99feb86257c64e18baa342d17824daade2bb5'
  },
  travis: {
    sync: false,
    authURL: 'https://crm.cairsolutions.com/api/oauth/access_token',
    apiURL: 'https://crm.cairsolutions.com/',
    clientId: '5632e8f0-9d30-2bc2-ff94-5d4390c099ee',
    secretKey: 'xxxxxxxxxxxxx',
    accessToken:
      'd1b58cfb23327c447347304020a99feb86257c64e18baa342d17824daade2bb5'
  },
  test: {
    sync: false,
    authURL: 'https://crm.cairsolutions.com/api/oauth/access_token',
    apiURL: 'https://crm.cairsolutions.com/',
    clientId: '5632e8f0-9d30-2bc2-ff94-5d4390c099ee',
    secretKey: 'xxxxxxxxxxxxx',
    accessToken:
      'd1b58cfb23327c447347304020a99feb86257c64e18baa342d17824daade2bb5'
  },
  testMac: {
    sync: false,
    authURL: 'https://crm.cairsolutions.com/api/oauth/access_token',
    apiURL: 'https://crm.cairsolutions.com/',
    clientId: '5632e8f0-9d30-2bc2-ff94-5d4390c099ee',
    secretKey: 'xxxxxxxxxxxxx',
    accessToken:
      'd1b58cfb23327c447347304020a99feb86257c64e18baa342d17824daade2bb5'
  },
  production: {
    sync: false,
    authURL: 'https://crm.cairsolutions.com/api/oauth/access_token',
    apiURL: 'https://crm.cairsolutions.com/',
    clientId: '5632e8f0-9d30-2bc2-ff94-5d4390c099ee',
    secretKey: 'xxxxxxxxxxxxx',
    accessToken:
      'd1b58cfb23327c447347304020a99feb86257c64e18baa342d17824daade2bb5'
  }
}

// module.exports.config = config;
