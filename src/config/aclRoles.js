'use strict'

/*
    Configuration file for gmail
*/

export default {
  development: {
    roles: [
      {
        role: 'child',
        ttl: '60 minutes'
      },
      {
        role: 'parent',
        ttl: '1 day'
      },
      {
        role: 'admin',
        ttl: '7 days'
      },
      {
        role: 'staff',
        ttl: '7 days'
      },
      {
        role: 'caseworker',
        ttl: '7 days'
      },
      {
        role: 'manager',
        ttl: '7 days'
      },
      {
        role: 'agency',
        ttl: '7 days'
      }
    ]
  },
  CI: {
    roles: [
      {
        role: 'child',
        ttl: '60 minutes'
      },
      {
        role: 'parent',
        ttl: '1 day'
      },
      {
        role: 'admin',
        ttl: '7 days'
      },
      {
        role: 'staff',
        ttl: '7 days'
      },
      {
        role: 'caseworker',
        ttl: '7 days'
      },
      {
        role: 'manager',
        ttl: '7 days'
      },
      {
        role: 'agency',
        ttl: '7 days'
      }
    ]
  },
  travis: {
    roles: [
      {
        role: 'child',
        ttl: '60 minutes'
      },
      {
        role: 'parent',
        ttl: '1 day'
      },
      {
        role: 'admin',
        ttl: '7 days'
      },
      {
        role: 'staff',
        ttl: '7 days'
      },
      {
        role: 'caseworker',
        ttl: '7 days'
      },
      {
        role: 'manager',
        ttl: '7 days'
      },
      {
        role: 'agency',
        ttl: '7 days'
      }
    ]
  },
  test: {
    roles: [
      {
        role: 'child',
        ttl: '60 minutes'
      },
      {
        role: 'parent',
        ttl: '1 day'
      },
      {
        role: 'admin',
        ttl: '7 days'
      },
      {
        role: 'staff',
        ttl: '7 days'
      },
      {
        role: 'caseworker',
        ttl: '7 days'
      },
      {
        role: 'manager',
        ttl: '7 days'
      },
      {
        role: 'agency',
        ttl: '7 days'
      }
    ]
  },
  testMac: {
    roles: [
      {
        role: 'child',
        ttl: '60 minutes'
      },
      {
        role: 'parent',
        ttl: '1 day'
      },
      {
        role: 'admin',
        ttl: '7 days'
      },
      {
        role: 'staff',
        ttl: '7 days'
      },
      {
        role: 'caseworker',
        ttl: '7 days'
      },
      {
        role: 'manager',
        ttl: '7 days'
      },
      {
        role: 'agency',
        ttl: '7 days'
      }
    ]
  },
  production: {
    roles: [
      {
        role: 'child',
        ttl: '60 minutes'
      },
      {
        role: 'parent',
        ttl: '1 day'
      },
      {
        role: 'admin',
        ttl: '7 days'
      },
      {
        role: 'staff',
        ttl: '7 days'
      },
      {
        role: 'caseworker',
        ttl: '7 days'
      },
      {
        role: 'manager',
        ttl: '7 days'
      },
      {
        role: 'agency',
        ttl: '7 days'
      }
    ]
  }
}
