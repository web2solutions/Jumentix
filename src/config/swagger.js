'use strict'

/*
    Configuration file for gmail
*/

export default function (APP_NAME, description) {
  return {
    development: {
      enabled: true, // router -> http://localhost:8000/docs/
      info: {
        version: 'v0.0.1',
        title: APP_NAME,
        description: description,
        contact: {
          name: 'Company name',
          url: 'http://www.company.com/',
          email: 'me@company.com'
        },
        license: {
          name: 'MIT'
        }
      }
    },
    CI: {
      enabled: true, // router -> http://localhost:8000/docs/
      info: {
        version: 'v0.0.1',
        title: APP_NAME,
        description: description,
        contact: {
          name: 'Company name',
          url: 'http://www.company.com/',
          email: 'me@company.com'
        },
        license: {
          name: 'MIT'
        }
      }
    },
    travis: {
      enabled: true, // router -> http://localhost:8000/docs/
      info: {
        version: 'v0.0.1',
        title: APP_NAME,
        description: description,
        contact: {
          name: 'Company name',
          url: 'http://www.company.com/',
          email: 'me@company.com'
        },
        license: {
          name: 'MIT'
        }
      }
    },
    test: {
      enabled: true, // router -> http://localhost:8000/docs/
      info: {
        version: 'v0.0.1',
        title: APP_NAME,
        description: description,
        contact: {
          name: 'Company name',
          url: 'http://www.company.com/',
          email: 'me@company.com'
        },
        license: {
          name: 'MIT'
        }
      }
    },
    testMac: {
      enabled: true, // router -> http://localhost:8000/docs/
      info: {
        version: 'v0.0.1',
        title: APP_NAME,
        description: description,
        contact: {
          name: 'Company name',
          url: 'http://www.company.com/',
          email: 'me@company.com'
        },
        license: {
          name: 'MIT'
        }
      }
    },
    production: {
      enabled: true, // router -> http://localhost:8000/docs/
      info: {
        version: 'v0.0.1',
        title: APP_NAME,
        description: description,
        contact: {
          name: 'Company name',
          url: 'http://www.company.com/',
          email: 'me@company.com'
        },
        license: {
          name: 'MIT'
        }
      }
    }
  }
}
