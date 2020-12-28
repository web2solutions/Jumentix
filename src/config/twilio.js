'use strict'

/*
    Configuration file for twilio
*/
import dotenv from 'dotenv'
dotenv.config()
const ACCOUNT_SID = process.env.TWILIO_ACCOUNTSID || 'xxxxxx'
const AUTH_TOKEN = process.env.TWILIO_AUTHTOKEN || 'xxxxxxx'
const PHONE_NUMBER = process.env.TWILIO_PHONENUMBER || 'xxxxxxx'

export default {
  development: {
    ACCOUNT_SID,
    AUTH_TOKEN,
    PHONE_NUMBER
  },
  CI: {
    ACCOUNT_SID,
    AUTH_TOKEN,
    PHONE_NUMBER
  },
  travis: {
    ACCOUNT_SID,
    AUTH_TOKEN,
    PHONE_NUMBER
  },
  test: {
    ACCOUNT_SID,
    AUTH_TOKEN,
    PHONE_NUMBER
  },
  testMac: {
    ACCOUNT_SID,
    AUTH_TOKEN,
    PHONE_NUMBER
  },
  production: {
    ACCOUNT_SID,
    AUTH_TOKEN,
    PHONE_NUMBER
  }
}
