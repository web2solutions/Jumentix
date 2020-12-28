'use strict'

/*
    Configuration file for authorize.net
*/
import dotenv from 'dotenv'
dotenv.config()
const apiLoginKey = process.env.AUTHORIZENET_APIKEY || 'xxxxxxxxx'
const transactionKey = process.env.AUTHORIZENET_TRANSACTIONKEY || 'xxxxxxx'

export default {
  development: {
    apiLoginKey,
    transactionKey
  },
  CI: {
    apiLoginKey,
    transactionKey
  },
  travis: {
    apiLoginKey,
    transactionKey
  },
  test: {
    apiLoginKey,
    transactionKey
  },
  testMac: {
    apiLoginKey,
    transactionKey
  },
  production: {
    apiLoginKey,
    transactionKey
  }
}
