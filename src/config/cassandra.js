'use strict'

import cassandra from 'express-cassandra'
const env = process.env.NODE_ENV || 'development'
/*
    Configuration file for gmail
*/

export default function (DB_NAME) {
  return {
    development: {
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        protocolOptions: {
          port: 9042
        },
        keyspace: `${DB_NAME}${env}`,
        queryOptions: {
          consistency: cassandra.consistencies.one
        }/* ,
        elasticsearch: {
          host: 'http://localhost:9200',
          apiVersion: '7.7',
          sniffOnStart: true
        } */
      },
      ormOptions: {
        defaultReplicationStrategy: {
          // class: 'NetworkTopologyStrategy',
          // DC1: 1
          class: 'SimpleStrategy',
          replication_factor: 1
        },
        migration: 'safe'
        // migration: 'alter',
        // manageESIndex: true
      }
    },
    CI: {
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        protocolOptions: {
          port: 9042
        },
        keyspace: `${DB_NAME}${env}`,
        queryOptions: {
          consistency: cassandra.consistencies.one
        }/* ,
        elasticsearch: {
          host: 'http://localhost:9200',
          apiVersion: '7.7',
          sniffOnStart: true
        } */
      },
      ormOptions: {
        defaultReplicationStrategy: {
          // class: 'NetworkTopologyStrategy',
          // DC1: 1
          class: 'SimpleStrategy',
          replication_factor: 1
        },
        migration: 'safe'
        // migration: 'alter',
        // manageESIndex: true
      }
    },
    travis: {
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        protocolOptions: {
          port: 9042
        },
        keyspace: `${DB_NAME}${env}`,
        queryOptions: {
          consistency: cassandra.consistencies.one
        }/* ,
        elasticsearch: {
          host: 'http://localhost:9200',
          apiVersion: '7.7',
          sniffOnStart: true
        } */
      },
      ormOptions: {
        defaultReplicationStrategy: {
          // class: 'NetworkTopologyStrategy',
          // DC1: 1
          class: 'SimpleStrategy',
          replication_factor: 1
        },
        migration: 'safe'
        // migration: 'alter',
        // manageESIndex: true
      }
    },
    test: {
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        protocolOptions: {
          port: 9042
        },
        keyspace: `${DB_NAME}${env}`,
        queryOptions: {
          consistency: cassandra.consistencies.one
        }/* ,
        elasticsearch: {
          host: 'http://localhost:9200',
          apiVersion: '7.7',
          sniffOnStart: true
        } */
      },
      ormOptions: {
        defaultReplicationStrategy: {
          // class: 'NetworkTopologyStrategy',
          // DC1: 1
          class: 'SimpleStrategy',
          replication_factor: 1
        },
        migration: 'safe'
        // migration: 'alter',
        // manageESIndex: true
      }
    },
    testMac: {
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        protocolOptions: {
          port: 9042
        },
        keyspace: `${DB_NAME}${env}`,
        queryOptions: {
          consistency: cassandra.consistencies.one
        }/* ,
        elasticsearch: {
          host: 'http://localhost:9200',
          apiVersion: '7.7',
          sniffOnStart: true
        } */
      },
      ormOptions: {
        defaultReplicationStrategy: {
          // class: 'NetworkTopologyStrategy',
          // DC1: 1
          class: 'SimpleStrategy',
          replication_factor: 1
        },
        migration: 'safe'
        // migration: 'alter',
        // manageESIndex: true
      }
    },
    production: {
      clientOptions: {
        contactPoints: ['127.0.0.1'],
        protocolOptions: {
          port: 9042
        },
        keyspace: `${DB_NAME}${env}`,
        queryOptions: {
          consistency: cassandra.consistencies.one
        }/* ,
        elasticsearch: {
          host: 'http://localhost:9200',
          apiVersion: '7.7',
          sniffOnStart: true
        } */
      },
      ormOptions: {
        defaultReplicationStrategy: {
          // class: 'NetworkTopologyStrategy',
          // DC1: 1
          class: 'SimpleStrategy',
          replication_factor: 1
        },
        migration: 'safe'
        // migration: 'alter',
        // manageESIndex: true
      }
    }
  }
}
