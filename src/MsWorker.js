'use strict'

import chalk from 'chalk'
import Application from './lib/Application'
import CassandraClient from './lib/CassandraClient'
import MongoClient from './lib/MongoClient'
import RabbitClient from './lib/RabbitClient'
import RedisClient from './lib/RedisClient'
import RPCMapper from './lib/RPCMapper'
import SequelizeClient from './lib/SequelizeClient'
import { isDefined, isObject, validateJob } from './lib/util'

class MsWorker extends SequelizeClient(
  MongoClient(CassandraClient(RabbitClient(RedisClient(Application))))
) {
  constructor (c) {
    super()
    this.console.banner('Starting ' + this.config.app.name)
    this.app = null
    this.c = isObject(c)
      ? c
      : {
          sequelize: false,
          mongo: false,
          cassandra: false,
          mediator: false,
          jobLogReader: false // is this an worker that reads logs ?
        }

    if (!isDefined(this.c.mediator)) {
      this.c.mediator = false
    }
    if (!isDefined(this.c.mongo)) {
      this.c.mongo = false
    }
    if (!isDefined(this.c.cassandra)) {
      this.c.cassandra = false
    }
    if (!isDefined(this.c.sequelize)) {
      this.c.sequelize = false
    }
  }

  /** start() {
        let self = this
        return new Promise(async function(resolve, reject) {
            try {
                await self.startRedis()
                if (self.c.mongo) {
                    await self.startMongo()
                }
                if (self.c.sequelize) {
                    await self.startSequelize()
                }

                await self.startMQ(!!self.c.mediator)

                self.mapperRPC = new RPCMapper(self)

                await self.mapperRPC.mapServices()

                process.on('SIGINT', async() => {
                    console.log("process SIGINT")
                    await self.serviceStop()
                    process.exit(-1)
                })

                //console.log( 'models', self.models )

                self.console.banner(self.config.app.name + ' is started ')
                resolve()
            } catch (e) {
                console.log(chalk.redBright(`Could not start ` + self.config.app.name))
                reject(e)
            }
        })
    } */

  async start () {
    const self = this
    try {
      await self.startRedis({
        pubSub: this.c.mediator // required for mediator
      })

      if (self.c.mongo) {
        await self.startMongo()
      }

      /** if (self.c.cassandra) {
                await self.startCassandra()
            }

            // not required for mediator
            if (self.c.sequelize) {
                await self.startSequelize()
            }

            await self.startExpress({
                io: this.c.mediator // required for mediator
            }) */

      await self.startMQ(!!this.c.mediator)

      self.mapperRPC = new RPCMapper(self)

      await self.mapperRPC.mapServices()

      process.on('SIGINT', async () => {
        console.log('process SIGINT')
        await self.serviceStop()
        process.exit(-1)
      })

      self.console.banner(self.config.app.name + ' is started ')

      if (process.send) {
        // console.log('process.send', process.send);
        process.send('ready')
      }
      return true
    } catch (e) {
      console.log(chalk.redBright('Could not start ' + self.config.app.name))
      return false
    }
  }

  // pertinent to to this application bussins logic
  consumeMessage (msg) {
    const self = this
    ;(async () => {
      let job = null
      let isMessageValid = false

      try {
        job = JSON.parse(msg.content.toString())
        isMessageValid = true
      } catch (e) {}

      if (!isMessageValid || !validateJob(job)) {
        self.channel.ack(msg)
        if (!isMessageValid) {
          self.console.error(
            'job is not a valid JSON. The received message was removed from the queue.',
            job
          )
        } else if (!validateJob(job)) {
          isMessageValid = false
          self.console.error(
            'job is not valid. The received message was removed from the queue.',
            job
          )
        }
        return
      }

      if (job.entity === '_worker_') {
        // if message was not set to this worker
        if (
          job.payload.workerName.toUpperCase() !== self.config.mq.workerName
        ) {
          self.console.log('ignoring ' + job.action + ' message.')
          self.channel.reject(msg)
          return
        }
      }

      // lets check if message is to stop or restart the worker
      if (job.entity === '_worker_' && job.action === 'stop') {
        self.channel.ack(msg)
        self.console.log('going to ' + job.action + ' in 2 seconds.')
        await self.stopProcess()
      } else if (job.entity === '_worker_' && job.action === 'restart') {
        self.channel.ack(msg)
        console.log('going to ' + job.action + ' in 2 seconds.')
        // remove shutdown message from queue
        await self.restartProcess()
      } else { // if not, then call controller.execute()
        // let set job in progress
        try {
          self.redis.store.set(
            'JobInProgress_' + self.config.mq.workerName,
            JSON.stringify(job)
          )
        } catch (e) {
          console.log(e)
        } finally {
          // console.log(job)
          console.log(job.uuid)
          self.mapperRPC.execute(job, msg)
        }
      }
    })()
  }
}

export default MsWorker
