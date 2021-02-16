'use strict'

import pmx from 'pmx'
import fs from 'fs'
// import path from 'path'
import chalk from 'chalk'
import pusage from 'pidusage'
import os from 'os'
import { createLogger, format, transports } from 'winston'
import 'winston-daily-rotate-file'

import CassandraClient from './CassandraClient'
import ExpressServer from './ExpressServer'
import MessageMediator from './MessageMediator'
import MongoClient from './MongoClient'
import RabbitClient from './RabbitClient'
import RedisClient from './RedisClient'
import SequelizeClient from './SequelizeClient'
import ElasticClient from './ElasticClient'
import EventSystem from './EventSystem'
import RPCMapper from './RPCMapper'

import config from '../config'
import configMQ from '../config/mq'
import configRedis from '../config/redis'
// import configCassandra from '../config/cassandra'
import configElastic from '../config/elastic'
import configGmail from '../config/gmail'
import configMailGun from '../config/mailgun'
import configAuthorizenet from '../config/authorizenet'
import configStripe from '../config/stripe'
import configPayPal from '../config/paypal'
import configAws from '../config/aws'
import configWordpress from '../config/wordpress'
import configYoutube from '../config/youtube'
import configZoho from '../config/zoho'
import configSuiteCRM from '../config/suitecrm'
import configTwilio from '../config/twilio'

import { composeMessageAlert as AlertComposer /* , getStatsAsobject */ } from './util'

class Application extends MessageMediator(
  ExpressServer(
    SequelizeClient(
      MongoClient(
        CassandraClient(
          RabbitClient(
            RedisClient(
              ElasticClient(
                EventSystem
              )
            )
          )
        )
      )
    )
  )
) {
  constructor () {
    super()
    const self = this
    process.on('SIGINT', () => {
      (async () => {
        console.log('process SIGINT')
        await self.serviceStop()
        process.exit(-1)
      })()
    })
    // configs
    self.env = process.env.NODE_ENV || 'development'
    self.config = {
      app: config[self.env],
      mq: configMQ[self.env],
      redis: configRedis[self.env],
      cassandra: config[self.env].cassandra,
      elastic: configElastic[self.env],
      gmail: configGmail[self.env],
      mailgun: configMailGun[self.env],

      suitecrm: configSuiteCRM[self.env],
      zoho: configZoho[self.env],
      wordpress: configWordpress[self.env],
      youtube: configYoutube[self.env],
      aws: configAws[self.env],

      authorizenet: configAuthorizenet[self.env],
      stripe: configStripe[self.env],
      paypal: configPayPal[self.env],

      twilio: configTwilio[self.env]
    }
    self.port = self.config.app.server.port || process.env.PORT
    // console.log(self.config.app.root)
    self.cdnROOT = self.config.app.cdn
    self.rootDir = self.config.app.root
    self.logDir = self.rootDir + '/logs'
    // configs

    self.logger = null

    this.started = false

    // mongo client
    // this.models = {}
    this.$db = null

    // holds cassandra client
    this.$cassandra = null

    // holds Elastic client
    this.$elastic = null

    // sequelize client
    this.sequelize = {
      Op: null,
      operatorsAliases: null,
      sequelize: null,
      Sequelize: null
      // models: {}
    }

    this.$models = {
      sequelize: {},
      mongoose: {}
    }

    this.sender = {}

    this.redis = null

    this.channel = null
    this.connection = null
    this.queueName = null
    this.exchangeName = null
    this.routingKey = null
    this.channelMediator = null
    this.queueNameMediator = null
    this.exchangeNameMediator = null
    this.routingKeyMediator = null
    this.timeOutMQReConnect = null
    this.rabbitmqConnectionStatus = null

    this.io = null
    this.users = []
    this.sockets = {}
    this.socket = null
    this.envelop = null
    this.channels = []

    this.on('service:start', (evtObj) => {
      console.error('STARTED')
      this.c.onStart()
    })

    this.on('service:stop', (evtObj) => {
      console.error('STTOPED')
      this.c.onStop()
    })

    self.startLoggerService()
    self.startConsoleService()
    self.startStatsService()
    self.checkCDNDir()

    // console.warn('==================', process.env.NODE_APP_INSTANCE)
  }

  checkCDNDir () {
    this.cdnProductDir = `${this.cdnROOT}${this.config.app.productPrefix}/`
    this.cdnAgencyDir = `${this.cdnProductDir}a${this.config.app.companyCode}/`
    this.cdnDIR = `${this.cdnAgencyDir}cdn/`
    fs.existsSync(this.cdnROOT) || fs.mkdirSync(this.cdnROOT)
    fs.existsSync(this.cdnProductDir) || fs.mkdirSync(this.cdnProductDir)
    fs.existsSync(this.cdnAgencyDir) || fs.mkdirSync(this.cdnAgencyDir)
    fs.existsSync(this.cdnDIR) || fs.mkdirSync(this.cdnDIR)
  }

  async start () {
    if (this.started) {
      return true
    }
    try {
      await this.serviceStart()
      this.started = true
      return true
    } catch (e) {
      console.log(e)
      console.log(chalk.redBright('Could not start ' + this.config.app.name))
      await this.serviceStop()
      process.exit(-1)
      // return false
    }
  }

  startStatsService () {
    const self = this

    pmx.init({
      http: true, // HTTP routes logging (default: true)
      errors: true, // Exceptions logging (default: true)
      custom_probes: true, // Auto expose JS Loop Latency and HTTP req/s as custom metrics
      network: false, // Network monitoring at the application level XXX BUG WITH AMQPLIB
      ports: true // Shows which ports your app is listening on (default: false)
    })
    // add pmx module to scope. pmx is used for metrics

    self.probe = pmx.probe()
    self.timeRamAndCpuChecking = 1 // seconds
    self.intervalRamAndCpuChecking = false

    self.cpu_metric = self.probe.metric({
      name: 'CPU usage',
      alert: {
        mode: 'threshold',
        value: self.config.app.maxCPUUsageInPercent,
        msg: self.config.app.cpu_usage_message, // optional
        func: function () {
          // const self_ = this
          const usage = arguments['0'] // self_.reached,
          const subject =
              self.config.app.name + ' - ' + self.config.app.cpu_usage_message
          let message =
              self.config.app.name +
              ' reached %' +
              usage +
              ' CPU usage. <br><br>'
          self.console.error(
            'CPU usage reached ' +
              chalk.bold.blue(usage) +
              '%. max allowed: ' +
              chalk.bold.blue(self.config.app.maxCPUUsageInPercent) +
              '%'
          )
          message = AlertComposer(message, os)
          try {
            if (self.sender) {
              self.sender.send.alert(subject, message)
            }
            if (self.logger) {
              self.logger.warn(message)
            }
          } catch (e) {}
        },
        cmp: function (value, threshold) {
          // optional
          return parseFloat(value) > threshold // default check
        }
      }
    })
    // set cpu usage metrics

    self.ram_metric = self.probe.metric({
      name: 'RAM usage',
      alert: {
        mode: 'threshold',
        value: self.config.app.maxRAMUsageInPercent,
        msg:
          'Detected over ' +
          self.config.app.maxRAMUsageInPercent +
          '% RAM usage', // optional
        func: function () {
          // optional

          // const self_ = this
          const usage = arguments['0'] // self_.reached,
          const subject =
              self.config.app.name + ' - ' + self.config.app.ramUsageMessage
          let message =
              self.config.app.name +
              ' reached %' +
              usage +
              ' RAM usage.<br><br>'
          self.console.error(
            'Ram memory usage reached ' +
              chalk.bold.blue(usage) +
              '%. max allowed: ' +
              chalk.bold.blue(self.config.app.maxRAMUsageInPercent) +
              '%'
          )
          message = AlertComposer(message, os)
          try {
            if (self.sender) {
              self.sender.send.alert(subject, message)
            }
            if (self.logger) {
              self.logger.warn(message)
            }
          } catch (e) {}
        },
        cmp: function (value, threshold) {
          // optional
          return parseFloat(value) > threshold // default check
        }
      }
    })
    const usageHandler = function (err, stat) {
      if (err) {
        // self.logger.error(err)
      }
      // console.warn(stat)
      const free = os.freemem()
      const total = os.totalmem()
      self.ram_metric.set((free * 100) / total)
      self.cpu_metric.set(stat.cpu)
    }
    const _pusage = () => {
      pusage(process.pid, usageHandler)
    }
    self.intervalRamAndCpuChecking = setInterval(_pusage, self.timeRamAndCpuChecking * 1000)

    self.metrics = {
      messages: {
        received: self.probe.counter({
          name: 'Received messages',
          agg_type: 'sum'
        }),
        errored: self.probe.counter({
          name: 'Errored messages',
          agg_type: 'sum'
        }),
        // metrics.messages.executed.inc();
        executed: self.probe.counter({
          name: 'Executed messages',
          agg_type: 'sum'
        })
      }
    }
  }

  startLoggerService () {
    const self = this

    if (!fs.existsSync(self.logDir)) {
      fs.mkdirSync(self.logDir)
    }

    self.logger = createLogger({
      // level: self.env === 'development' ? 'debug' : 'info',
      level: 'info',
      handleExceptions: true,
      exitOnError: false,
      logstash: true,
      maxsize: 1024 * 1024,
      // You can also comment out the line above and uncomment the line below for JSON format
      // format : format.json(),
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        // format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),

        format.json()
      ),
      transports: [
        new transports.DailyRotateFile({
          filename: `${self.logDir}/%DATE%-results.log`,
          datePattern: 'YYYY-MM-DD'
        })
      ]
    })
  }

  startConsoleService () {
    const self = this

    self.console = {
      process: function (p) {
        console.log(
          ' user ' + p.env.LOGNAME + '. pid ' + p.pid + ' ppid ' + p.ppid
        )
      },
      banner: function (msg) {
        const date = new Date()
        const time =
            ('0' + date.getHours()).slice(-2) +
            ':' +
            ('0' + date.getMinutes()).slice(-2)
        console.log(
          time +
            ' - ' +
            chalk.black.bold.bgYellow(`.           ${msg}           .`)
        )
      },
      error: function (msg) {
        const date = new Date()
        const time =
            ('0' + date.getHours()).slice(-2) +
            ':' +
            ('0' + date.getMinutes()).slice(-2)
        console.error(
          time +
            ' - ' +
            chalk.red.bold.bgWhite(
              `.          ${msg.message || msg}          .`
            )
        )
        self.logger.error(msg)
        // logger.warn(msg)
      },
      warn: function (msg) {
        const date = new Date()
        const time =
            ('0' + date.getHours()).slice(-2) +
            ':' +
            ('0' + date.getMinutes()).slice(-2)
        console.warn(
          time + ' - ' + chalk.white.bold.bgRed(`.          ${msg}          .`)
        )
        self.logger.warn(msg)
      },
      info: function (msg) {
        const date = new Date()
        const time =
            ('0' + date.getHours()).slice(-2) +
            ':' +
            ('0' + date.getMinutes()).slice(-2)
        console.log(
          time +
            ' - ' +
            chalk.white.bold.bgGreen('[INFO]') +
            chalk.blue.bold.bgWhite(msg)
        )
        self.logger.info(msg)
      },
      notice: function (msg, data) {
        const date = new Date()
        const time =
            ('0' + date.getHours()).slice(-2) +
            ':' +
            ('0' + date.getMinutes()).slice(-2)
        console.log(
          time +
            ' - ' +
            chalk.white.bold.bgBlue('[NOTICE]') +
            chalk.underline.magenta(msg)
        )
        if (data) {
          data.forEach((i) => {
            console.log(chalk.white.bold.bgCyan(`       ${i}         `))
          })
        }
      },
      session: function (name, userId, agencyId, socket) {
        console.log(chalk.bold.yellow('------->'))
        console.log(`${chalk.underline.bold.red('New socket session:')}
                       User:            ${chalk.underline.blue(name)}
                       User ID:         ${chalk.underline.blue(userId)}
                       Agency ID:       ${chalk.underline.blue(agencyId)}
                       Socket ID:       ${chalk.underline.blue(socket.id)}
                `)
      }
    }
  }

  async serviceStop (error = null) {
    const r = { error }
    if (this.intervalRamAndCpuChecking) {
      clearInterval(this.intervalRamAndCpuChecking)
    }
    if (this.connection) {
      await this.stopMQ()
    }
    if (this.redis) {
      await this.stopRedis()
    }
    if (this.$db) {
      await this.stopMongoDB()
    }
    if (this.$cassandra) {
      await this.stopCassandraDB()
    }
    if (this.$elastic) {
      await this.stopElastic()
    }
    this.console.info(this.config.app.name + ' is quit ')
    this.triggerEvent('service:stop', r)
    process.exit(0)
    // return r
  }

  async serviceStart (error = null) {
    console.error('serviceStart')
    const self = this
    const r = {
      error
    }
    // MAP HTTP messages to an correlated Entity action
    this.mapperRPC = new RPCMapper(this)
    await this.mapperRPC.mapServices()

    const rResponse = await this.startRedis({
      pubSub: this.c.mediator // required for mediator
    })
    if (rResponse.error) {
      await this.serviceStop(rResponse.error)
      process.exit(-1)
    }

    if (this.c.mongo) {
      const sMR = await this.startMongo()
      if (sMR.error) {
        await this.serviceStop(sMR.error)
        process.exit(-1)
      }
    }

    if (this.c.cassandra) {
      const sCR = await this.startCassandra()
      if (sCR.error) {
        await this.serviceStop(sCR.error)
        process.exit(-1)
      }
    }

    if (this.c.elastic) {
      const sER = await this.startElastic()
      if (sER.error) {
        await this.serviceStop(sER.error)
        process.exit(-1)
      }
    }

    // not required for mediator
    if (this.c.sequelize) {
      await this.startSequelize()
    }

    const mqResponse = await this.startMQ(!!this.c.mediator)
    if (mqResponse.error) {
      await this.serviceStop(mqResponse.error)
      process.exit(-1)
    }

    const expressServer = await this.startExpress({
      io: this.c.mediator // required for mediator
    })
    if (expressServer.error) {
      await this.serviceStop(expressServer.error)
      process.exit(-1)
      // return false
    }
    if (process.send) {
      process.send('ready')
    }
    self.triggerEvent('service:start', {
      application: self,
      error
    })
    self.console.banner(self.config.app.name + ' is started ')
    return r
  }

  consumeMessage (msg) {
    // set application.consumeMessage(msg)
    // does nothing.
    // called by default when a message is income from RabbitMQ
    // Shall to be overwrited on Created Application level
  }

  async stopProcess () {
    const self = this
    const pkg = require('../package.json')
    // shutdown worker
    await self.serviceStop()

    if (self.env === 'development') {
      // using something like nodemon
      process.exit(0)
    } else {
      // using pm2
      const pm2 = require('pm2')
      self.console.info('connecting to pm2 ')
      pm2.connect(function (err) {
        if (err) {
          self.console.info(' error connecting to pm2  ', err)
          process.exit(2)
        }
        self.console.info(' going to stop ' + pkg.main + ' via pm2  ')
        pm2.stop(pkg.main, function (err, processDescription) {
          if (err) {
            self.console.error(err)
          } else {
            self.console.info(processDescription)
            self.console.info(pkg.main + ' is stopped  ')
          }
          pm2.disconnect()
        })
      })
    }
  }

  async restartProcess () {
    const self = this
    const pkg = require('../package.json')
    await self.stopProcess()
    if (self.env === 'development') {
      // using something like nodemon
      self.console.info('restarting running process ')
      const spawn = require('child_process').spawn;
      (function main () {
        if (process.env.process_restarting) {
          delete process.env.process_restarting
          // Give old process one second to shut down before continuing ...
          setTimeout(main, 1000)
          return
        }
        // Restart process ...
        spawn(process.argv[0], process.argv.slice(1), {
          env: {
            process_restarting: 1
          },
          stdio: 'ignore'
        }).unref()
      })()
    } else {
      // using pm2
      const pm2 = require('pm2')
      self.console.info('connecting to pm2 ')
      pm2.connect(function (err) {
        if (err) {
          self.console.warn(' error connecting to pm2  ')
          console.error(err)
          process.exit(2)
        }
        self.console.info(' going to stop ' + pkg.main + ' via pm2  ')
        pm2.restart(pkg.main, function (err, processDescription) {
          if (err) {
            self.console.error(err)
          } else {
            self.console.info(processDescription)
            self.console.info(pkg.main + ' is restarted  ')
          }
          pm2.disconnect()
        })
      })
    }
  }
}

export default Application
