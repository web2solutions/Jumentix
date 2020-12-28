'use strict'

/*
    Configuration file for Aws
*/
export default {
  development: {
    config: {
      accessKeyId: 'xxxx',
      secretAccessKey: 'xxxxxxxxxxxxx',
      region: 'us-west-2'
    },
    s3: {
      sync: false,
      bucketName: 'cairs',
      bucketURL: 'https://cairs.s3.amazonaws.com/'
    }
  },
  CI: {
    config: {
      accessKeyId: 'xxxx',
      secretAccessKey: 'xxxxxxxxxxxxx',
      region: 'us-west-2'
    },
    s3: {
      sync: false,
      bucketName: 'cairs',
      bucketURL: 'https://cairs.s3.amazonaws.com/'
    }
  },
  travis: {
    config: {
      accessKeyId: 'xxxx',
      secretAccessKey: 'xxxxxxxxxxxxx',
      region: 'us-west-2'
    },
    s3: {
      sync: false,
      bucketName: 'cairs',
      bucketURL: 'https://cairs.s3.amazonaws.com/'
    }
  },
  test: {
    config: {
      accessKeyId: 'xxxx',
      secretAccessKey: 'xxxxxxxxxxxxx',
      region: 'us-west-2'
    },
    s3: {
      sync: false,
      bucketName: 'cairs',
      bucketURL: 'https://cairs.s3.amazonaws.com/'
    }
  },
  testMac: {
    config: {
      accessKeyId: 'xxxx',
      secretAccessKey: 'xxxxxxxxxxxxx',
      region: 'us-west-2'
    },
    s3: {
      sync: false,
      bucketName: 'cairs',
      bucketURL: 'https://cairs.s3.amazonaws.com/'
    }
  },
  production: {
    config: {
      accessKeyId: 'xxxx',
      secretAccessKey: 'xxxxxxxxxxxxx',
      region: 'us-west-2'
    },
    s3: {
      sync: false,
      bucketName: 'cairs',
      bucketURL: 'https://cairs.s3.amazonaws.com/'
    }
  }
}
