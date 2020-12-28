'use strict'

import Application from './lib/Application'
import Composer from './lib/mediator/Composer'
import { isDefined, isObject, validateJob } from './lib/util'

class MsRESTAPI extends Application {
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
          elastic: false,
          jobLogReader: false, // is this an worker that reads logs ?
          onStart: () => { },
          onStop: () => { }
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
    if (!isDefined(this.c.elastic)) {
      this.c.elastic = false
    }
    if (!isDefined(this.c.onStart)) {
      this.c.onStart = () => { }
    }
    if (!isDefined(this.c.onStop)) {
      this.c.onStop = () => { }
    }

    this.mapperRPC = null

    if (this.c.mediator) {
      this.io = null

      this.users = []
      this.sockets = {}
      this.socket = null
      this.envelop = new Composer()
      this.channels = []
    }
  }

  // pertinent to to this application bussins logic
  consumeMessage (msg, channel, queueName) {
    const self = this
    ;(async () => {
      let job = null
      let isMessageValid = false
      // console.log('>>>>>>> consumeMessage')
      try {
        job = JSON.parse(msg.content.toString())
        isMessageValid = true
      } catch (e) {}

      if (!isMessageValid || !validateJob(job)) {
        // channel.ack(msg)
        channel.nack(msg, false, false) // reject and delete from queue
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
          channel.reject(msg)
          return
        }
      }

      // lets check if message is to stop or restart the worker
      if (job.entity === '_worker_' && job.action === 'stop') {
        channel.ack(msg)
        self.console.log('going to ' + job.action + ' in 2 seconds.')
        await self.stopProcess()
      } else if (job.entity === '_worker_' && job.action === 'restart') {
        channel.ack(msg)
        console.log('going to ' + job.action + ' in 2 seconds.')
        // remove shutdown message from queue
        await self.restartProcess()
      } else {
        if (job.action !== 'getAll') {
          job.subject = 'Information about job ' + job.uuid
          job.message =
            'Information about job ' +
            job.uuid +
            ' - ' +
            job.entity +
            ' ' +
            job.action +
            ' '
          self.io.of('/').emit('data:sync', job)
        }

        // self.sendMessageToUser(job.entity, job.to, data)
        channel.ack(msg)
      }
    })()
  }
}

export default MsRESTAPI
