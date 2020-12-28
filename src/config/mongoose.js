'use strict'

const env = process.env.NODE_ENV || 'development'

/*
    Configuration file for gmail
*/

export default function (DB_NAME) {
  return {
    development: {
      // MongoDB
      // uri: mongodb://username:password@host:port/database?options
      uri: `mongodb://localhost:27017/${DB_NAME}${env}`,
      options: {
        useNewUrlParser: true,
        poolSize: 10 // Can now run 10 operations at a time
        // replicaSet: 'rs'
      }
    },
    CI: {
      // MongoDB
      // uri: mongodb://username:password@host:port/database?options
      uri: `mongodb://localhost:27017/${DB_NAME}${env}`,
      options: {
        useNewUrlParser: true,
        poolSize: 10 // Can now run 10 operations at a time
        // replicaSet: 'rs'
      }
    },
    travis: {
      // MongoDB
      // uri: mongodb://username:password@host:port/database?options
      uri: `mongodb://localhost:27017/${DB_NAME}${env}`,
      options: {
        useNewUrlParser: true,
        poolSize: 10 // Can now run 10 operations at a time
        // replicaSet: 'rs'
      }
    },
    test: {
      // MongoDB
      // uri: mongodb://username:password@host:port/database?options
      uri: `mongodb://localhost:27017/${DB_NAME}${env}`,
      options: {
        useNewUrlParser: true,
        poolSize: 10 // Can now run 10 operations at a time
        // replicaSet: 'rs'
      }
    },
    testMac: {
      // MongoDB
      // uri: mongodb://username:password@host:port/database?options
      uri: `mongodb://localhost:27017/${DB_NAME}${env}`,
      options: {
        useNewUrlParser: true,
        poolSize: 10 // Can now run 10 operations at a time
        // replicaSet: 'rs'
      }
    },
    production: {
      // MongoDB
      // uri: mongodb://username:password@host:port/database?options
      uri: `mongodb://localhost:27017/${DB_NAME}${env}`,
      options: {
        useNewUrlParser: true,
        poolSize: 10 // Can now run 10 operations at a time
        // replicaSet: 'rs'
      }
    }
  }
}
