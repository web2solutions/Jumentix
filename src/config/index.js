'use strict'
import path from 'path'
import oAuthConf from './oAuth'
import swaggerConf from './swagger'
import mongooseConf from './mongoose'
import cassandraConf from './cassandra'
import aclRoles from './aclRoles'

const pkg = require('../../package.json')
const productPrefix = 'JumentiX'
const APP_NAME = pkg.name
const COMPANY_ID = 1
const description = `RESTful API ${APP_NAME}`
const DB_NAME = `${productPrefix}_a${COMPANY_ID}_`
const maxCPUUsageInPercent = 40
const maxRAMUsageInPercent = 40
const env = process.env.NODE_ENV || 'development'

/*
    Configuration file
*/

export default {
  development: {
    http_body_size: '50mb', // body parser values
    pagingDefaultLimit: 10,
    secret: 'L0stInSpace', // Secret Key
    swagger: swaggerConf(APP_NAME, description)[env],
    oAuth: oAuthConf[env],
    roles: aclRoles[env].roles,
    server: {
      // Express
      ip: 'localhost',
      port: 3001
    },
    log: true, // show logs
    mongoose: mongooseConf(DB_NAME)[env],
    cassandra: cassandraConf(DB_NAME)[env],
    // globals
    env: process.env.NODE_ENV || 'development', // mode
    name: `${APP_NAME}-${parseInt(process.env.NODE_APP_INSTANCE) || 0}`, // name
    node: parseInt(process.env.NODE_APP_INSTANCE) || 0,
    dbName: DB_NAME + env,
    maxCPUUsageInPercent: maxCPUUsageInPercent,
    // set max cpu usage in % to trigger a message alert to author and contributors
    // nodejs apps generally are low cpu usage. if it is consuming considerable cpu,
    //  then make sure that is everything ok with your app
    maxRAMUsageInPercent: maxRAMUsageInPercent,
    // set max RAM memory usage in % to trigger a message alert to author and contributors
    cpu_usage_message: 'Detected over ' + maxCPUUsageInPercent + '% CPU usage',
    // defaut max cpu usage message
    ramUsageMessage: 'Detected over ' + maxRAMUsageInPercent + '% RAM usage',
    onLineUsersStorageName: `${productPrefix}_ONLINE_USERS`,
    channelsStorageName: `${productPrefix}_users_channels`,
    root: path.normalize(`${__dirname}/../..`), // root
    cdn: path.normalize(`${__dirname}/../../../CDN/`), // cdn
    base: path.normalize(`${__dirname}/../lib/`), // base,
    timezone: 'America/New_York',
    companyCode: COMPANY_ID,
    productPrefix: productPrefix
  },
  CI: {
    http_body_size: '50mb', // body parser values
    pagingDefaultLimit: 10,
    secret: 'L0stInSpace', // Secret Key
    swagger: swaggerConf(APP_NAME, description)[env],
    oAuth: oAuthConf[env],
    roles: aclRoles[env].roles,
    server: {
      // Express
      ip: 'localhost',
      port: 3001
    },
    log: true, // show logs
    mongoose: mongooseConf(DB_NAME)[env],
    cassandra: cassandraConf(DB_NAME)[env],
    // globals
    env: process.env.NODE_ENV || 'development', // mode
    name: `${APP_NAME}-${parseInt(process.env.NODE_APP_INSTANCE) || 0}`, // name
    node: parseInt(process.env.NODE_APP_INSTANCE) || 0,
    dbName: DB_NAME + env,
    maxCPUUsageInPercent: maxCPUUsageInPercent,
    // set max cpu usage in % to trigger a message alert to author and contributors
    // nodejs apps generally are low cpu usage. if it is consuming considerable cpu,
    //  then make sure that is everything ok with your app
    maxRAMUsageInPercent: maxRAMUsageInPercent,
    // set max RAM memory usage in % to trigger a message alert to author and contributors
    cpu_usage_message: 'Detected over ' + maxCPUUsageInPercent + '% CPU usage',
    // defaut max cpu usage message
    ramUsageMessage: 'Detected over ' + maxRAMUsageInPercent + '% RAM usage',
    onLineUsersStorageName: `${productPrefix}_ONLINE_USERS`,
    channelsStorageName: `${productPrefix}_users_channels`,
    root: path.normalize(`${__dirname}/../..`), // root
    cdn: path.normalize(`${__dirname}/../../../CDN/`), // cdn
    base: path.normalize(`${__dirname}/../lib/`), // base,
    timezone: 'America/New_York',
    companyCode: COMPANY_ID,
    productPrefix: productPrefix
  },
  travis: {
    http_body_size: '50mb', // body parser values
    pagingDefaultLimit: 10,
    secret: 'L0stInSpace', // Secret Key
    swagger: swaggerConf(APP_NAME, description)[env],
    oAuth: oAuthConf[env],
    roles: aclRoles[env].roles,
    server: {
      // Express
      ip: 'localhost',
      port: 3001
    },
    log: true, // show logs
    mongoose: mongooseConf(DB_NAME)[env],
    cassandra: cassandraConf(DB_NAME)[env],
    // globals
    env: process.env.NODE_ENV || 'development', // mode
    name: `${APP_NAME}-${parseInt(process.env.NODE_APP_INSTANCE) || 0}`, // name
    node: parseInt(process.env.NODE_APP_INSTANCE) || 0,
    dbName: DB_NAME + env,
    maxCPUUsageInPercent: maxCPUUsageInPercent,
    // set max cpu usage in % to trigger a message alert to author and contributors
    // nodejs apps generally are low cpu usage. if it is consuming considerable cpu,
    //  then make sure that is everything ok with your app
    maxRAMUsageInPercent: maxRAMUsageInPercent,
    // set max RAM memory usage in % to trigger a message alert to author and contributors
    cpu_usage_message: 'Detected over ' + maxCPUUsageInPercent + '% CPU usage',
    // defaut max cpu usage message
    ramUsageMessage: 'Detected over ' + maxRAMUsageInPercent + '% RAM usage',
    onLineUsersStorageName: `${productPrefix}_ONLINE_USERS`,
    channelsStorageName: `${productPrefix}_users_channels`,
    root: path.normalize(`${__dirname}/../..`), // root
    cdn: path.normalize(`${__dirname}/../../../CDN/`), // cdn
    base: path.normalize(`${__dirname}/../lib/`), // base,
    timezone: 'America/New_York',
    companyCode: COMPANY_ID,
    productPrefix: productPrefix
  },
  test: {
    http_body_size: '50mb', // body parser values
    pagingDefaultLimit: 10,
    secret: 'L0stInSpace', // Secret Key
    swagger: swaggerConf(APP_NAME, description)[env],
    oAuth: oAuthConf[env],
    roles: aclRoles[env].roles,
    server: {
      // Express
      ip: 'localhost',
      port: 3001
    },
    log: true, // show logs
    mongoose: mongooseConf(DB_NAME)[env],
    cassandra: cassandraConf(DB_NAME)[env],
    // globals
    env: process.env.NODE_ENV || 'development', // mode
    name: `${APP_NAME}-${parseInt(process.env.NODE_APP_INSTANCE) || 0}`, // name
    node: parseInt(process.env.NODE_APP_INSTANCE) || 0,
    dbName: DB_NAME + env,
    maxCPUUsageInPercent: maxCPUUsageInPercent,
    // set max cpu usage in % to trigger a message alert to author and contributors
    // nodejs apps generally are low cpu usage. if it is consuming considerable cpu,
    //  then make sure that is everything ok with your app
    maxRAMUsageInPercent: maxRAMUsageInPercent,
    // set max RAM memory usage in % to trigger a message alert to author and contributors
    cpu_usage_message: 'Detected over ' + maxCPUUsageInPercent + '% CPU usage',
    // defaut max cpu usage message
    ramUsageMessage: 'Detected over ' + maxRAMUsageInPercent + '% RAM usage',
    onLineUsersStorageName: `${productPrefix}_ONLINE_USERS`,
    channelsStorageName: `${productPrefix}_users_channels`,
    root: path.normalize(`${__dirname}/../..`), // root
    cdn: path.normalize(`${__dirname}/../../../CDN/`), // cdn
    base: path.normalize(`${__dirname}/../lib/`), // base,
    timezone: 'America/New_York',
    companyCode: COMPANY_ID,
    productPrefix: productPrefix
  },
  testMac: {
    http_body_size: '50mb', // body parser values
    pagingDefaultLimit: 10,
    secret: 'L0stInSpace', // Secret Key
    swagger: swaggerConf(APP_NAME, description)[env],
    oAuth: oAuthConf[env],
    roles: aclRoles[env].roles,
    server: {
      // Express
      ip: 'localhost',
      port: 3001
    },
    log: true, // show logs
    mongoose: mongooseConf(DB_NAME)[env],
    cassandra: cassandraConf(DB_NAME)[env],
    // globals
    env: process.env.NODE_ENV || 'development', // mode
    name: `${APP_NAME}-${parseInt(process.env.NODE_APP_INSTANCE) || 0}`, // name
    node: parseInt(process.env.NODE_APP_INSTANCE) || 0,
    dbName: DB_NAME + env,
    maxCPUUsageInPercent: maxCPUUsageInPercent,
    // set max cpu usage in % to trigger a message alert to author and contributors
    // nodejs apps generally are low cpu usage. if it is consuming considerable cpu,
    //  then make sure that is everything ok with your app
    maxRAMUsageInPercent: maxRAMUsageInPercent,
    // set max RAM memory usage in % to trigger a message alert to author and contributors
    cpu_usage_message: 'Detected over ' + maxCPUUsageInPercent + '% CPU usage',
    // defaut max cpu usage message
    ramUsageMessage: 'Detected over ' + maxRAMUsageInPercent + '% RAM usage',
    onLineUsersStorageName: `${productPrefix}_ONLINE_USERS`,
    channelsStorageName: `${productPrefix}_users_channels`,
    root: path.normalize(`${__dirname}/../..`), // root
    cdn: path.normalize(`${__dirname}/../../../CDN/`), // cdn
    base: path.normalize(`${__dirname}/../lib/`), // base,
    timezone: 'America/New_York',
    companyCode: COMPANY_ID,
    productPrefix: productPrefix
  },
  production: {
    http_body_size: '50mb', // body parser values
    pagingDefaultLimit: 10,
    secret: 'L0stInSpace', // Secret Key
    swagger: swaggerConf(APP_NAME, description)[env],
    oAuth: oAuthConf[env],
    roles: aclRoles[env].roles,
    server: {
      // Express
      ip: 'localhost',
      port: 3001
    },
    log: true, // show logs
    mongoose: mongooseConf(DB_NAME)[env],
    cassandra: cassandraConf(DB_NAME)[env],
    // globals
    env: process.env.NODE_ENV || 'development', // mode
    name: `${APP_NAME}-${parseInt(process.env.NODE_APP_INSTANCE) || 0}`, // name
    node: parseInt(process.env.NODE_APP_INSTANCE) || 0,
    dbName: DB_NAME + env,
    maxCPUUsageInPercent: maxCPUUsageInPercent,
    // set max cpu usage in % to trigger a message alert to author and contributors
    // nodejs apps generally are low cpu usage. if it is consuming considerable cpu,
    //  then make sure that is everything ok with your app
    maxRAMUsageInPercent: maxRAMUsageInPercent,
    // set max RAM memory usage in % to trigger a message alert to author and contributors
    cpu_usage_message: 'Detected over ' + maxCPUUsageInPercent + '% CPU usage',
    // defaut max cpu usage message
    ramUsageMessage: 'Detected over ' + maxRAMUsageInPercent + '% RAM usage',
    onLineUsersStorageName: `${productPrefix}_ONLINE_USERS`,
    channelsStorageName: `${productPrefix}_users_channels`,
    root: path.normalize(`${__dirname}/../..`), // root
    cdn: path.normalize(`${__dirname}/../../../CDN/`), // cdn
    base: path.normalize(`${__dirname}/../lib/`), // base,
    timezone: 'America/New_York',
    companyCode: COMPANY_ID,
    productPrefix: productPrefix
  }
}
