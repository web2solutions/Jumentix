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
    authURL: 'https://accounts.zoho.com/oauth/v2/token',
    apiURL: 'https://www.zohoapis.com/crm/v2/',
    client_id: '1000.3FGXC8ZF2WIBR05ZYPZC7EA17QZ7SH',
    client_secret: 'xxxxxxxxxxxxx',
    refresh_token:
      '1000.c02e0cfa555993c50235956cf2a3cb04.1920511bd45f386a86aaa15dff7b0a6b'
  },
  CI: {
    sync: false,
    authURL: 'https://accounts.zoho.com/oauth/v2/token',
    apiURL: 'https://www.zohoapis.com/crm/v2/',
    client_id: '1000.3FGXC8ZF2WIBR05ZYPZC7EA17QZ7SH',
    client_secret: 'xxxxxxxxxxxxx',
    refresh_token:
      '1000.c02e0cfa555993c50235956cf2a3cb04.1920511bd45f386a86aaa15dff7b0a6b'
  },
  travis: {
    sync: false,
    authURL: 'https://accounts.zoho.com/oauth/v2/token',
    apiURL: 'https://www.zohoapis.com/crm/v2/',
    client_id: '1000.3FGXC8ZF2WIBR05ZYPZC7EA17QZ7SH',
    client_secret: 'xxxxxxxxxxxxx',
    refresh_token:
      '1000.c02e0cfa555993c50235956cf2a3cb04.1920511bd45f386a86aaa15dff7b0a6b'
  },
  test: {
    sync: false,
    authURL: 'https://accounts.zoho.com/oauth/v2/token',
    apiURL: 'https://www.zohoapis.com/crm/v2/',
    client_id: '1000.3FGXC8ZF2WIBR05ZYPZC7EA17QZ7SH',
    client_secret: 'xxxxxxxxxxxxx',
    refresh_token:
      '1000.c02e0cfa555993c50235956cf2a3cb04.1920511bd45f386a86aaa15dff7b0a6b'
  },
  testMac: {
    sync: false,
    authURL: 'https://accounts.zoho.com/oauth/v2/token',
    apiURL: 'https://www.zohoapis.com/crm/v2/',
    client_id: '1000.3FGXC8ZF2WIBR05ZYPZC7EA17QZ7SH',
    client_secret: 'xxxxxxxxxxxxx',
    refresh_token:
      '1000.c02e0cfa555993c50235956cf2a3cb04.1920511bd45f386a86aaa15dff7b0a6b'
  },
  production: {
    sync: false,
    authURL: 'https://accounts.zoho.com/oauth/v2/token',
    apiURL: 'https://www.zohoapis.com/crm/v2/',
    client_id: '1000.3FGXC8ZF2WIBR05ZYPZC7EA17QZ7SH',
    client_secret: 'xxxxxxxxxxxxx',
    refresh_token:
      '1000.c02e0cfa555993c50235956cf2a3cb04.1920511bd45f386a86aaa15dff7b0a6b'
  }
}

// module.exports.config = config;
