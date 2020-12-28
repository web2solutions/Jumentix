'use strict'

/*
    Configuration file for MQ
*/
import config from './'
const env = process.env.NODE_ENV || 'development'
const conf = config[env]

export default {
  development: {
    rabbitServer: 'localhost',
    rabbitPort: '5672',
    rabbitHeartBeat: '60',
    rabbitUser: 'rabbitmq',
    rabbitPassword: 'rabbitmq',
    // exchanhe name which the worker listen to receive messages
    exchange: `${conf.productPrefix}`,

    /*
            main queue which this application listens to.
            This queue is used to orchestrate this application.
        */
    // queue name which the worker listen to receive messages
    queue: `${conf.productPrefix}.REST.API.${conf.companyCode}`,
    // routing key name which the worker filters to receive messages from
    routingKey: `${conf.productPrefix}.REST.API.${conf.companyCode}`,

    /*
            send app stats information to admins via email messages
        */
    // routing key name which the worker sends alerts notification messages to
    alertNotificationRoutingKey: `${conf.productPrefix}.Notification.${conf.companyCode}`,
    // queue name which the worker sends alerts notification messages to
    alertNotificationQueue: `${conf.productPrefix}.Notification.${conf.companyCode}`,

    /*
            send job execution log to log queue
        */
    // routing key name which the worker sends logs to
    jobLogRoutingKey: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // queue name which the worker sends logs to
    jobLogQueue: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // should executed job be sent as log ?
    isSendJobLog: true,

    /*
            send notifications to clients about job executio via Mediator
        */
    // routing key name for clients notification
    notifyMediatorRoutingKey: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    // queue name  for clients notification
    notifyMediatorQueue: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    isNotifyMediator: true,

    /*
            send notifications to clients about job execution via email
        */
    mailQueue: `${conf.productPrefix}.Gmail.Send.${conf.companyCode}`,
    isSendClientMail: true,

    // worker name: shall to be unique. Dont chang this. Get from package.json
    workerName: `${conf.name}.${conf.companyCode}`,
    // time to wait before trying to reconnect to rabbitMQ again
    // in seconds
    restartIn: 1
  },
  CI: {
    rabbitServer: 'localhost',
    rabbitPort: '5672',
    rabbitHeartBeat: '60',
    rabbitUser: 'guest',
    rabbitPassword: 'guest',
    // exchanhe name which the worker listen to receive messages
    exchange: `${conf.productPrefix}`,

    /*
            main queue which this application listens to.
            This queue is used to orchestrate this application.
        */
    // queue name which the worker listen to receive messages
    queue: `${conf.productPrefix}.REST.API.${conf.companyCode}`,
    // routing key name which the worker filters to receive messages from
    routingKey: `${conf.productPrefix}.REST.API.${conf.companyCode}`,

    /*
            send app stats information to admins via email messages
        */
    // routing key name which the worker sends alerts notification messages to
    alertNotificationRoutingKey: `${conf.productPrefix}.Notification.${conf.companyCode}`,
    // queue name which the worker sends alerts notification messages to
    alertNotificationQueue: `${conf.productPrefix}.Notification.${conf.companyCode}`,

    /*
            send job execution log to log queue
        */
    // routing key name which the worker sends logs to
    jobLogRoutingKey: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // queue name which the worker sends logs to
    jobLogQueue: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // should executed job be sent as log ?
    isSendJobLog: true,

    /*
            send notifications to clients about job executio via Mediator
        */
    // routing key name for clients notification
    notifyMediatorRoutingKey: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    // queue name  for clients notification
    notifyMediatorQueue: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    isNotifyMediator: true,

    /*
            send notifications to clients about job execution via email
        */
    mailQueue: `${conf.productPrefix}.Gmail.Send.${conf.companyCode}`,
    isSendClientMail: true,

    // worker name: shall to be unique. Dont chang this. Get from package.json
    workerName: `${conf.name}.${conf.companyCode}`,
    // time to wait before trying to reconnect to rabbitMQ again
    // in seconds
    restartIn: 1
  },
  travis: {
    rabbitServer: 'localhost',
    rabbitPort: '5672',
    rabbitHeartBeat: '60',
    rabbitUser: 'rabbitmq',
    rabbitPassword: 'rabbitmq',
    // exchanhe name which the worker listen to receive messages
    exchange: `${conf.productPrefix}`,

    /*
            main queue which this application listens to.
            This queue is used to orchestrate this application.
        */
    // queue name which the worker listen to receive messages
    queue: `${conf.productPrefix}.REST.API.${conf.companyCode}`,
    // routing key name which the worker filters to receive messages from
    routingKey: `${conf.productPrefix}.REST.API.${conf.companyCode}`,

    /*
            send app stats information to admins via email messages
        */
    // routing key name which the worker sends alerts notification messages to
    alertNotificationRoutingKey: `${conf.productPrefix}.Notification.${conf.companyCode}`,
    // queue name which the worker sends alerts notification messages to
    alertNotificationQueue: `${conf.productPrefix}.Notification.${conf.companyCode}`,

    /*
            send job execution log to log queue
        */
    // routing key name which the worker sends logs to
    jobLogRoutingKey: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // queue name which the worker sends logs to
    jobLogQueue: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // should executed job be sent as log ?
    isSendJobLog: true,

    /*
            send notifications to clients about job executio via Mediator
        */
    // routing key name for clients notification
    notifyMediatorRoutingKey: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    // queue name  for clients notification
    notifyMediatorQueue: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    isNotifyMediator: true,

    /*
            send notifications to clients about job execution via email
        */
    mailQueue: `${conf.productPrefix}.Gmail.Send.${conf.companyCode}`,
    isSendClientMail: true,

    // worker name: shall to be unique. Dont chang this. Get from package.json
    workerName: `${conf.name}.${conf.companyCode}`,
    // time to wait before trying to reconnect to rabbitMQ again
    // in seconds
    restartIn: 1
  },
  test: {
    rabbitServer: '192.168.1.36',
    rabbitPort: '5672',
    rabbitHeartBeat: '60',
    rabbitUser: 'JumentiX',
    rabbitPassword: 'JumentiX',
    // exchanhe name which the worker listen to receive messages
    exchange: `${conf.productPrefix}`,

    /*
            main queue which this application listens to.
            This queue is used to orchestrate this application.
        */
    // queue name which the worker listen to receive messages
    queue: `${conf.productPrefix}.REST.API.${conf.companyCode}`,
    // routing key name which the worker filters to receive messages from
    routingKey: `${conf.productPrefix}.REST.API.${conf.companyCode}`,

    /*
            send app stats information to admins via email messages
        */
    // routing key name which the worker sends alerts notification messages to
    alertNotificationRoutingKey: `${conf.productPrefix}.Notification.${conf.companyCode}`,
    // queue name which the worker sends alerts notification messages to
    alertNotificationQueue: `${conf.productPrefix}.Notification.${conf.companyCode}`,

    /*
            send job execution log to log queue
        */
    // routing key name which the worker sends logs to
    jobLogRoutingKey: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // queue name which the worker sends logs to
    jobLogQueue: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // should executed job be sent as log ?
    isSendJobLog: true,

    /*
            send notifications to clients about job executio via Mediator
        */
    // routing key name for clients notification
    notifyMediatorRoutingKey: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    // queue name  for clients notification
    notifyMediatorQueue: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    isNotifyMediator: true,

    /*
            send notifications to clients about job execution via email
        */
    mailQueue: `${conf.productPrefix}.Gmail.Send.${conf.companyCode}`,
    isSendClientMail: true,

    // worker name: shall to be unique. Dont chang this. Get from package.json
    workerName: `${conf.name}.${conf.companyCode}`,
    // time to wait before trying to reconnect to rabbitMQ again
    // in seconds
    restartIn: 1
  },
  testMac: {
    rabbitServer: '192.168.204.101',
    rabbitPort: '5672',
    rabbitHeartBeat: '60',
    rabbitUser: 'rabbitmq',
    rabbitPassword: 'rabbitmq',
    // exchanhe name which the worker listen to receive messages
    exchange: `${conf.productPrefix}`,

    /*
            main queue which this application listens to.
            This queue is used to orchestrate this application.
        */
    // queue name which the worker listen to receive messages
    queue: `${conf.productPrefix}.REST.API.${conf.companyCode}`,
    // routing key name which the worker filters to receive messages from
    routingKey: `${conf.productPrefix}.REST.API.${conf.companyCode}`,

    /*
            send app stats information to admins via email messages
        */
    // routing key name which the worker sends alerts notification messages to
    alertNotificationRoutingKey: `${conf.productPrefix}.Notification.${conf.companyCode}`,
    // queue name which the worker sends alerts notification messages to
    alertNotificationQueue: `${conf.productPrefix}.Notification.${conf.companyCode}`,

    /*
            send job execution log to log queue
        */
    // routing key name which the worker sends logs to
    jobLogRoutingKey: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // queue name which the worker sends logs to
    jobLogQueue: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // should executed job be sent as log ?
    isSendJobLog: true,

    /*
            send notifications to clients about job executio via Mediator
        */
    // routing key name for clients notification
    notifyMediatorRoutingKey: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    // queue name  for clients notification
    notifyMediatorQueue: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    isNotifyMediator: true,

    /*
            send notifications to clients about job execution via email
        */
    mailQueue: `${conf.productPrefix}.Gmail.Send.${conf.companyCode}`,
    isSendClientMail: true,

    // worker name: shall to be unique. Dont chang this. Get from package.json
    workerName: `${conf.name}.${conf.companyCode}`,
    // time to wait before trying to reconnect to rabbitMQ again
    // in seconds
    restartIn: 1
  },
  production: {
    rabbitServer: '192.168.1.69',
    rabbitPort: '5672',
    rabbitHeartBeat: '60',
    rabbitUser: 'JumentiX',
    rabbitPassword: 'JumentiX',
    // exchanhe name which the worker listen to receive messages
    exchange: `${conf.productPrefix}`,

    /*
            main queue which this application listens to.
            This queue is used to orchestrate this application.
        */
    // queue name which the worker listen to receive messages
    queue: `${conf.productPrefix}.REST.API.${conf.companyCode}`,
    // routing key name which the worker filters to receive messages from
    routingKey: `${conf.productPrefix}.REST.API.${conf.companyCode}`,

    /*
            send app stats information to admins via email messages
        */
    // routing key name which the worker sends alerts notification messages to
    alertNotificationRoutingKey: `${conf.productPrefix}.Notification.${conf.companyCode}`,
    // queue name which the worker sends alerts notification messages to
    alertNotificationQueue: `${conf.productPrefix}.Notification.${conf.companyCode}`,

    /*
            send job execution log to log queue
        */
    // routing key name which the worker sends logs to
    jobLogRoutingKey: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // queue name which the worker sends logs to
    jobLogQueue: `${conf.productPrefix}.Common.Logger.${conf.companyCode}`,
    // should executed job be sent as log ?
    isSendJobLog: true,

    /*
            send notifications to clients about job executio via Mediator
        */
    // routing key name for clients notification
    notifyMediatorRoutingKey: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    // queue name  for clients notification
    notifyMediatorQueue: `${conf.productPrefix}.Mediator.${conf.companyCode}`,
    isNotifyMediator: true,

    /*
            send notifications to clients about job execution via email
        */
    mailQueue: `${conf.productPrefix}.Gmail.Send.${conf.companyCode}`,
    isSendClientMail: true,

    // worker name: shall to be unique. Dont chang this. Get from package.json
    workerName: `${conf.name}.${conf.companyCode}`,
    // time to wait before trying to reconnect to rabbitMQ again
    // in seconds
    restartIn: 1
  }
}

// module.exports.config = config;
