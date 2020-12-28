'use strict'

/*
    Configuration file for gmail
*/
import dotenv from 'dotenv'
dotenv.config()
const user = process.env.GMAIL_USER || 'me@mail.com'
const pass = process.env.GMAIL_password || 'xxxxxxx'

export default {
  development: {
    user,
    pass,
    sender: `"JumentiX Mail Worker" <${user}>`
  },
  CI: {
    user,
    pass,
    sender: `"JumentiX Mail Worker" <${user}>`
  },
  travis: {
    user,
    pass,
    sender: `"JumentiX Mail Worker" <${user}>`
  },
  test: {
    user,
    pass,
    sender: `"JumentiX Mail Worker" <${user}>`
  },
  testMac: {
    user,
    pass,
    sender: `"JumentiX Mail Worker" <${user}>`
  },
  production: {
    user,
    pass,
    sender: `"JumentiX Mail Worker" <${user}>`
  }
}
