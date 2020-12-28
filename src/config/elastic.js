'use strict'

/*
    Configuration file for Redis
*/
import mainConf from './'
const env = process.env.NODE_ENV || 'development'
const conf = mainConf[env]

const config = {
  development: {
    name: conf.name,
    node: {
      url: new URL('http://localhost:9200'),
      // ssl: 'ssl options',
      // agent: 'http agent options',
      // id: 'custom node id',
      // headers: {
      //  'custom': 'headers'
      // },
      roles: {
        master: true,
        data: true,
        ingest: true,
        ml: false
      }
    },
    // ssl: {
    //  ca: fs.readFileSync('./cacert.pem'),
    //  rejectUnauthorized: false
    // },
    // auth: {
    //  username: 'elastic',
    //  password: 'changeme'
    // }
    // auth: {
    //  apiKey: 'base64EncodedKey'
    // }
    // cloud: {
    //  id: 'name:bG9jYWxob3N0JGFiY2QkZWZnaA==',
    // },
    maxRetries: 5,
    requestTimeout: 60000,
    sniffOnStart: true
  },
  CI: {
    name: conf.name,
    node: {
      url: new URL('http://localhost:9200'),
      // ssl: 'ssl options',
      // agent: 'http agent options',
      // id: 'custom node id',
      // headers: {
      //  'custom': 'headers'
      // },
      roles: {
        master: true,
        data: true,
        ingest: true,
        ml: false
      }
    },
    // ssl: {
    //  ca: fs.readFileSync('./cacert.pem'),
    //  rejectUnauthorized: false
    // },
    // auth: {
    //  username: 'elastic',
    //  password: 'changeme'
    // }
    // auth: {
    //  apiKey: 'base64EncodedKey'
    // }
    // cloud: {
    //  id: 'name:bG9jYWxob3N0JGFiY2QkZWZnaA==',
    // },
    maxRetries: 5,
    requestTimeout: 60000,
    sniffOnStart: true
  },
  travis: {
    name: conf.name,
    node: {
      url: new URL('http://localhost:9200'),
      // ssl: 'ssl options',
      // agent: 'http agent options',
      // id: 'custom node id',
      // headers: {
      //  'custom': 'headers'
      // },
      roles: {
        master: true,
        data: true,
        ingest: true,
        ml: false
      }
    },
    // ssl: {
    //  ca: fs.readFileSync('./cacert.pem'),
    //  rejectUnauthorized: false
    // },
    // auth: {
    //  username: 'elastic',
    //  password: 'changeme'
    // }
    // auth: {
    //  apiKey: 'base64EncodedKey'
    // }
    // cloud: {
    //  id: 'name:bG9jYWxob3N0JGFiY2QkZWZnaA==',
    // },
    maxRetries: 5,
    requestTimeout: 60000,
    sniffOnStart: true
  },
  test: {
    name: conf.name,
    node: {
      url: new URL('http://localhost:9200'),
      // ssl: 'ssl options',
      // agent: 'http agent options',
      // id: 'custom node id',
      // headers: {
      //  'custom': 'headers'
      // },
      roles: {
        master: true,
        data: true,
        ingest: true,
        ml: false
      }
    },
    // ssl: {
    //  ca: fs.readFileSync('./cacert.pem'),
    //  rejectUnauthorized: false
    // },
    // auth: {
    //  username: 'elastic',
    //  password: 'changeme'
    // }
    // auth: {
    //  apiKey: 'base64EncodedKey'
    // }
    // cloud: {
    //  id: 'name:bG9jYWxob3N0JGFiY2QkZWZnaA==',
    // },
    maxRetries: 5,
    requestTimeout: 60000,
    sniffOnStart: true
  },
  testMac: {
    name: conf.name,
    node: {
      url: new URL('http://localhost:9200'),
      // ssl: 'ssl options',
      // agent: 'http agent options',
      // id: 'custom node id',
      // headers: {
      //  'custom': 'headers'
      // },
      roles: {
        master: true,
        data: true,
        ingest: true,
        ml: false
      }
    },
    // ssl: {
    //  ca: fs.readFileSync('./cacert.pem'),
    //  rejectUnauthorized: false
    // },
    // auth: {
    //  username: 'elastic',
    //  password: 'changeme'
    // }
    // auth: {
    //  apiKey: 'base64EncodedKey'
    // }
    // cloud: {
    //  id: 'name:bG9jYWxob3N0JGFiY2QkZWZnaA==',
    // },
    maxRetries: 5,
    requestTimeout: 60000,
    sniffOnStart: true
  },
  production: {
    name: conf.name,
    node: {
      url: new URL('http://localhost:9200'),
      // ssl: 'ssl options',
      // agent: 'http agent options',
      // id: 'custom node id',
      // headers: {
      //  'custom': 'headers'
      // },
      roles: {
        master: true,
        data: true,
        ingest: true,
        ml: false
      }
    },
    // ssl: {
    //  ca: fs.readFileSync('./cacert.pem'),
    //  rejectUnauthorized: false
    // },
    // auth: {
    //  username: 'elastic',
    //  password: 'changeme'
    // }
    // auth: {
    //  apiKey: 'base64EncodedKey'
    // }
    // cloud: {
    //  id: 'name:bG9jYWxob3N0JGFiY2QkZWZnaA==',
    // },
    maxRetries: 5,
    requestTimeout: 60000,
    sniffOnStart: true
  }
}
export default config
