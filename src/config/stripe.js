'use strict'

/*
    Configuration file for stripe
*/
import dotenv from 'dotenv'
dotenv.config()
const Publishablekey = process.env.STRIPE_PUBLISHABLEKEY || 'xxxxxxxxx'
const Secretkey = process.env.STRIPE_SECRETKEY || 'xxxxxxx'

export default {
  development: {
    Publishablekey,
    Secretkey
  },
  CI: {
    Publishablekey,
    Secretkey
  },
  travis: {
    Publishablekey,
    Secretkey
  },
  test: {
    Publishablekey,
    Secretkey
  },
  testMac: {
    Publishablekey,
    Secretkey
  },
  production: {
    Publishablekey,
    Secretkey
  }
}
