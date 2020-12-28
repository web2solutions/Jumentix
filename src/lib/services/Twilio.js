'use strict'
import Service from '../Job/Service' // mandatory
// import * as Client from 'twilio'

// import { mailOptions, decodeString, formatMessage } from '../util'

/**
 * Class representing a Twilio Service
 * @extends Service
 */
class Twilio extends Service {
  /**
   * Creates a Twilio Service
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor (application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call
    this.entity = 'Twilio'
    // console.info('this.application.config', this.application.config.gmail)
    this.$twilio = require('twilio')(this.application.config.twilio.ACCOUNT_SID, this.application.config.twilio.AUTH_TOKEN)
    // this.$twilio = Client(this.application.config.twilio.ACCOUNT_SID, this.application.config.twilio.AUTH_TOKEN)
  }

  async send (job, msg) {
    const payload = job.payload
    let data = null
    let error = null
    let status = 500
    /* const self = this
    const payload = job.payload // payload is the resource information associated to this task data
    let gMailOpt = null
    const _attachments = []
    const subject = payload.subject
    const message = payload.message
    const to = payload.to
    const bcc = payload.bcc || '' */

    const to = payload.to
    const from = payload.from
    const body = payload.body
    try {
      const response = await this.$twilio.messages.create({
        to,
        from,
        body
      })
      data = response
      error = null
      status = 201
    } catch (e) {
      error = e
      data = null
      status = 500
    }
    if (error) {
      this.jobNotDone(job, msg, `error sending sms via ${this.entity} - ${error}`)
    } else {
      this.jobDone(job, data, msg)
    }

    return { data, error, status }
    // this.jobDone(job, data, msg)
    /* return {
      error,
      data,
      status
    } */
  }
}

export default Twilio
