'use strict'

import amqp from 'amqplib'
import { messageToQueue } from './rabbitmq/senderAPI/messageToQueue'
import { notifyMediator } from './rabbitmq/senderAPI/notifyMediator'
import { log } from './rabbitmq/senderAPI/log'
import { alert } from './rabbitmq/senderAPI/alert'
import { mailSender } from './rabbitmq/senderAPI/mailSender'
import { jobMailNotification } from './rabbitmq/senderAPI/jobMailNotification'

// mixin
const RabbitClient = (RabbitClient) =>
  class extends RabbitClient {
    async startMQ (isMediator = false) {
      const self = this
      const error = false

      try {
        self.console.info(' Starting RabbitMQ Client')
        self.connection = false
        self.queueName = self.config.mq.queue
        // the queue name which this worker listens to
        // change it in the file ../../config/mq.js
        self.exchangeName = self.config.mq.exchange
        // the exchange name which this worker listens to
        // this worker may be sending message to this exchange too.
        //      Ex: when sending a notification message
        // change it in the file ../../config/mq.js
        self.routingKey = self.config.mq.routingKey
        // main application channel
        self.channel = false
        self.isMediator = isMediator
        // mediator channel, listen to notifications
        self.channelMediator = false
        self.channelSender = false
        self.queueNameMediator = self.config.mq.notifyMediatorQueue
        self.exchangeNameMediator = self.config.mq.exchange
        self.routingKeyMediator = self.config.mq.notifyMediatorRoutingKey
        self.rabbitmqConnectionStatus = 'closed'

        const cMQR = await self.connectMQ()
        if (cMQR.error) {
          return {
            error: cMQR.error
          }
        } else {
          self.mountSendAPI()
          self.console.info(' RabbitMQ Client is done')
          return {
            error
          }
        }
      } catch (e) {
        console.log('>>>>1', e)
        self.console.error(e.message)
        self.console.error('Could not start RabbitMQ')
        return {
          error: e
        }
      }
    }

    setConnectionStatus (status) {
      this.rabbitmqConnectionStatus = status
    }

    getConnectionStatus () {
      return this.rabbitmqConnectionStatus
    }

    getConnSettings () {
      const self = this
      return {
        protocol: 'amqp',
        hostname: self.config.mq.rabbitServer,
        port: self.config.mq.rabbitPort,
        username: self.config.mq.rabbitUser,
        password: self.config.mq.rabbitPassword,
        locale: 'en_US',
        frameMax: 0,
        heartbeat: self.config.mq.rabbitHeartBeat,
        vhost: '/'
      }
    }

    async createMainChannel () {
      const self = this
      let error = false
      let channel = false
      try {
        channel = await self.connection.createChannel()
        self.channel = channel
        const channelResponse = await self.setupChannel()
        if (channelResponse.error) {
          error = channelResponse.error
        }
        return {
          error,
          channel
        }
      } catch (e) {
        self.console.error(e.message)
        console.log('>>>>2', e)
        return {
          error: e
        }
      }
    }

    async createSenderChannel () {
      const self = this
      let error = false
      let channel = false
      try {
        channel = await self.connection.createConfirmChannel()
        self.channelSender = channel
        const channelResponse = await self.setupSenderChannel()
        if (channelResponse.error) {
          error = channelResponse.error
        }
        return {
          error,
          channel
        }
      } catch (e) {
        self.console.error(e.message)
        console.log('>>>>2', e)
        return {
          error: e
        }
      }
    }

    async createMediatorChannel () {
      const self = this
      let error = false
      let channel = false
      try {
        channel = await self.connection.createChannel()
        self.channelMediator = channel
        const channelResponse = await self.setupChannelMediator()
        if (channelResponse.error) {
          error = channelResponse.error
        }
        return {
          error,
          channel
        }
      } catch (e) {
        self.console.error(e.message)
        console.log('>>>>3', e)
        return {
          error: e,
          channel
        }
      }
    }

    async connectMQ () {
      const self = this
      const error = false
      try {
        self.connection = await amqp.connect(self.getConnSettings())
        self.console.info('     RabbitMQ connection is ready!')

        const rCMC = await self.createMainChannel()
        if (rCMC.error) {
          return {
            error: rCMC.error,
            connection: self.connection
          }
        }

        const rCSC = await self.createSenderChannel()
        if (rCSC.error) {
          return {
            error: rCSC.error,
            connection: self.connection
          }
        }

        // if not is running Mediator
        if (!self.isMediator) {
          return {
            error,
            connection: self.connection
          }
        }

        // create Mediator channel
        const rCMeC = await self.createMediatorChannel()
        if (rCMeC.error) {
          return {
            error: rCMeC.error,
            connection: self.connection
          }
        }

        return {
          error,
          connection: self.connection
        }
      } catch (e) {
        self.console.error(e.message)
        self.console.warn(
          'Can not connect to RabbitMQ @ ' + self.config.mq.rabbitServer,
          e.message
        )
        return {
          error: e
        }
      }
    }

    async setupChannel () {
      const self = this
      const error = false
      let queue = false

      try {
        // setup channel onError event
        self.channel.on('error', function (err) {
          console.error('[AMQP] channel error', err.message)
          self.setConnectionStatus('closed due channel error')
          // process.exit(1)
        })

        // setup channel onClose event
        self.channel.on('close', function () {
          self.console.warn('[AMQP] channel closed')
          self.setConnectionStatus('closed due channel closed')
          // process.exit(1)
        })

        self.channel.prefetch(1)

        await self.channel.assertExchange(self.exchangeName, 'topic', {
          durable: true
        })

        queue = await self.channel.assertQueue(self.queueName, {
          durable: true
        })

        self.channel.bindQueue(
          queue.queue,
          self.exchangeName,
          self.routingKey
        )

        self.channel
          .consume(
            queue.queue,
            function (msg) {
              try {
                self.metrics.messages.received.inc()
                self.consumeMessage(msg, self.channel, queue.queue)
              } catch (e) {
                self.console.warn(e)
              }
            }, {
              noAck: false
            }
          )
          .then(function (ok) {
            console.log('CONSUMED', ok)
          })

        self.console.info('     RabbitMQ Main channel is ready!')
        self.console.banner(
          `   [*] Waiting for messages in: ${self.exchangeName}  ${queue.queue}`
        )

        return {
          error,
          channel: self.channel
        }
      } catch (e) {
        // statements
        self.console.error(e.message)
        return {
          error: e
        }
      }
    }

    async setupSenderChannel () {
      const self = this
      const error = false

      try {
        // setup channel onError event
        self.channelSender.on('error', function (err) {
          console.error('[AMQP] channel error', err.message)
          self.setConnectionStatus('closed due channel error')
          // process.exit(1)
        })

        // setup channel onClose event
        self.channelSender.on('close', function () {
          self.console.warn('[AMQP] channel closed')
          self.setConnectionStatus('closed due channel closed')
          // process.exit(1)
        })

        self.channelSender.on('return', function () {
          self.console.warn('[AMQP] returned message - not delivered')
          console.log(arguments)
        })

        self.channelSender.waitForConfirms(function () {
          console.log('self.channelSender.waitForConfirms')
          console.log(arguments)
        })

        // await self.channelSender.assertExchange(self.exchangeName, 'topic', { durable: true });

        /* queue = await self.channelSender.assertQueue(self.queueName, {
              durable: true
          });

          self.channelSender.bindQueue(queue.queue, self.exchangeName, self.routingKey); */

        self.console.info('     RabbitMQ Sender channel is ready!')

        return {
          error,
          channel: self.channelSender
        }
      } catch (e) {
        // statements
        self.console.error(e.message)
        return {
          error: e
        }
      }
    }

    async setupChannelMediator () {
      const self = this
      const error = false
      let queue = false

      try {
        // setup channel onError event
        self.channelMediator.on('error', function (err) {
          console.error('[AMQP] channel error', err.message)
          self.setConnectionStatus('closed due channel error')
          // process.exit(1)
        })

        // setup channel onClose event
        self.channelMediator.on('close', function () {
          self.console.warn('[AMQP] channel closed')
          self.setConnectionStatus('closed due channel closed')
          // process.exit(1)
        })

        self.channelMediator.prefetch(1)

        await self.channelMediator.assertExchange(
          self.exchangeName,
          'topic', {
            durable: true
          }
        )

        queue = await self.channelMediator.assertQueue(
          self.queueNameMediator, {
            durable: true
          }
        )

        self.channelMediator.bindQueue(
          queue.queue,
          self.exchangeName,
          self.routingKeyMediator
        )

        self.channelMediator
          .consume(
            queue.queue,
            (msg) => {
              // console.log(msg)
              try {
                self.metrics.messages.received.inc()
                self.consumeMessage(msg, self.channelMediator, queue.queue)
              } catch (e) {
                self.console.warn(e)
                console.log(e)
              }
            }, {
              noAck: false
            }
          )
          .then(function (ok) {
            console.log('CONSUMED', ok)
          })

        self.console.info('     RabbitMQ Mediator channel is ready!')
        self.console.banner(
          `   [*] Waiting for messages in: ${self.exchangeName} ${queue.queue}`
        )

        return {
          error,
          channel: self.channelMediator
        }
      } catch (e) {
        // statements
        self.console.error(e.message)
        return {
          error: e
        }
      }
    }

    async reconnectMQ () {
      const self = this
      const r = { error: null, status: null }
      try {
        await self.connectMQ()
        r.status = 'ok'
      } catch (e) {
        self.console.error(`Could not start reconnect to MQ ${e.message}`)
        r.status = null
        r.error = e
      }
      return r
    }

    async stopMQ () {
      const self = this
      const r = { error: null, status: null }
      try {
        // close channel if is there one open
        if (self.channel) {
          await self.channel.close()
        }
        if (self.channelSender) {
          await self.channelSender.close()
        }
        if (self.channelMediator) {
          await self.channelMediator.close()
        }

        // close rabbitmq connection if is there one open
        if (self.connection) {
          await self.connection.close()
        }

        self.connection = false
        self.channel = false
        self.channelMediator = false
        self.channelSender = false
        r.status = 'stop'
        self.console.info(' RabbitMQ Client is stopped')
      } catch (e) {
        self.console.error(`Could not stop MQ ${e.message}`)
        r.status = null
        r.error = e
      }
      return r
    }

    async mountSendAPI () {
      const self = this

      await self.channelSender.assertQueue(
        self.config.mq.notifyMediatorQueue, {
          durable: true
        }
      )
      await self.channelSender.assertQueue(self.config.mq.jobLogQueue, {
        durable: true
      })
      await self.channelSender.assertQueue(
        self.config.mq.alertNotificationQueue, {
          durable: true
        }
      )
      await self.channelSender.assertQueue(self.config.mq.mailQueue, {
        durable: true
      })

      self.sender.send = {
        messageToQueue: messageToQueue.bind(self),
        notifyMediator: notifyMediator.bind(self),
        log: log.bind(self),
        alert: alert.bind(self),
        mail: mailSender.bind(self),
        jobMailNotification: jobMailNotification.bind(self)
      }
    }

    getServerUser () {
      const self = this
      const serverName =
        this.config.app.name +
        ' user ' +
        process.env.LOGNAME +
        '. pid ' +
        process.pid +
        ' ppid ' +
        process.ppid

      return {
        id: '5fd18f300000000000000000', //
        name: serverName,
        userId: '5fd18f300000000000000000', // ppid
        companyId: self.config.app.companyCode || 1,
        user_email: self.config.gmail.sender,
        deleted: false,
        active: true,
        human: {
          _id: '5fd18f300000000000000000'
        }
      }
    }
  }

export default RabbitClient
