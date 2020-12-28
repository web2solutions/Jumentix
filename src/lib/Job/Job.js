'use strict'

import CRUD from '../DataAccess/CRUD'
import RabbitEnvelop from '../RabbitEnvelop'
import { validateJob } from '../util'

/**
 * Handles every Job execution
 * @class
 */
class Job extends CRUD {
  /**
   * Creates Job interface
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor (application) {
    super(application)
    this.isJobDone = false
  }

  /**
   * send notification to orchestrator worker
   * @param {object} job object
   * @param {object} data object which represents the brand new created server resource document or boolean false
   * @param {boolean} isJobDone boolean indicating if job is done
   * @param {string} error message
   */
  /* sendNotification(job, data, isJobDone, err) {
        data = data || false;
        err = err || false;
        let notification_job = new RabbitEnvelop({
            uuid: job.uuid,
            from: job.from,
            payload: job.payload,
            entity: job.entity,
            action: job.action,
            data: data,
            success: isJobDone,
            error: err,
            status: isJobDone ? "done" : "not done"
        })
        this.application.sender.send.notification(notification_job)

    }
    // alias to sendNotification
    sendErrorNotification(job, errorMessage) {
        console.error(errorMessage)
        console.warn('tried job: ', job)
        this.sendNotification(job, false, false, {
            message: errorMessage
        })
    } */
  // send message to Mediator
  sendClientNotification (c) {
    const data = c.data || false
    try {
      const clientNotificationJob = new RabbitEnvelop({
        uuid: c.job.uuid,
        from: c.job.from,
        to: c.job.from,
        payload: c.job.payload,
        entity: c.job.entity,
        action: c.job.action,
        data: data,
        success: !!data,
        error: c.error || false,
        status: data ? 'done' : 'not done'
      })

      this.application.sender.send.notifyMediator(clientNotificationJob)
    } catch (e) {
      this.application.console.warn(' sendClientNotification ERROR ')
      this.application.console.warn(e)
    }
  }

  // send job result to Log queue
  sendLog (c) {
    const data = c.data || false
    const self = this

    // set on app.js
    if (this.application.c.jobLogReader) {
      return
    }

    // set on config
    if (!this.application.config.mq.isSendJobLog) {
      return
    }

    if (!c.job.action) {
      this.application.console.warn(' NO JOB to log ')
      return
    }

    try {
      const logJob = new RabbitEnvelop({
        uuid: c.job.uuid,
        from: c.job.from,
        to: c.job.from,
        payload: {
          uuid: c.job.uuid,
          from: c.job.from,
          payload: c.job.payload,
          entity: c.job.entity,
          action: c.job.action,
          data: data,
          success: c.success || false,
          error: c.error || false,
          status: data ? 'done' : 'not done',
          companyId: self.application.config.app.companyCode
        },
        entity: c.job.entity,
        action: c.job.action,
        data: data,
        success: c.success || false,
        error: c.error || false,
        status: data ? 'done' : 'not done'
      })
      // console.log('logJob', logJob)
      this.application.sender.send.log(logJob)
    } catch (e) {
      this.application.console.warn(' sendLog ERROR ')
      this.application.console.warn(e)
    }
  }

  // check if task is valid. silently call jobNotDone() if not valid
  isValidJob (job, msg) {
    let ok = true

    msg = msg || false

    if (!validateJob(job)) {
      ok = false
      this.jobNotDone(
        job,
        msg,
        'Error when saving on table - job is not valid.'
      )
    }
    return ok
  }

  // must be called when worker complete job execution with success
  jobDone (job, data, msg) {
    // client acknowledgement is received
    if (msg) {
      this.application.channel.ack(msg)
    }

    this.application.metrics.messages.executed.inc()

    //  this.application.redis.store.set('JobInProgress_' + this.application.config.mq.workerName, '{}')

    this.sendAllMessages(job, true, false, data, true)

    this.application.console.info(' [x] Done ')
  }

  // must be called when worker complete job execution with no success
  jobNotDone (job, msg, errMessage) {
    if (msg) {
      this.application.channel.nack(msg, false, false)
    }

    this.application.metrics.messages.errored.inc()

    // this.application.redis.store.set('JobInProgress_' + this.application.config.mq.workerName, JSON.stringify(job))

    this.sendAllMessages(job, false, errMessage, false, false)

    this.application.console.warn(' [x] Done with ERROR ')
  }

  sendAllMessages (
    job,
    success = false,
    error = false,
    data = false,
    isJobDone = false
  ) {
    // console.log('job', job)
    /**
     *  send message about the JOB execution to jobLogQueue
     *  the jobLogQueue will be used for job recovery and job execution stats
     *  if this app is a jo log reader, then dont create a log
     * */

    this.sendLog({
      job,
      data,
      success,
      error
    })

    /**
     *  send message to the Mediator queue
     *  the Mediator queue will be used to send messages to connected JumentiX clients
     *  about the job execution
     * */
    if (this.application.config.mq.isNotifyMediator) {
      this.sendClientNotification({
        job,
        data,
        error
      })
    }

    // send messages to client via Gmail
    if (this.application.config.mq.isSendClientMail) {
      if (!this.application.c.jobLogReader) {
        this.application.sender.send.jobMailNotification({
          job,
          // msg: msg,
          data,
          error
        })
      }
    }
  }
}

export default Job
