'use strict'
import nodemailer from 'nodemailer'
import fetch_base64 from 'fetch-base64'
import handlebars from 'handlebars'
import fs from 'fs'
import Service from '../Job/Service' // mandatory

import { mailOptions, decodeString, formatMessage } from '../util'

/**
 * Class representing a Gmail Service
 * @extends Service
 */
class Gmail extends Service {
  /**
   * Creates a Gmail Service
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor (application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call
    const self = this
    this.entity = 'Gmail'
    // console.info('this.application.config', this.application.config.gmail)
    this.fromSender = this.application.config.gmail.sender
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: self.application.config.gmail.user, // generated ethereal user
        pass: self.application.config.gmail.pass // generated ethereal password
      }
    })

    // self.application.config.mq.isSendClientMail = false
  }

  send (job, msg) {
    const self = this
    const payload = job.payload // payload is the resource information associated to this task data
    let gMailOpt = null
    const _attachments = []
    const subject = payload.subject
    const message = payload.message
    const to = payload.to
    const bcc = payload.bcc || ''
    const attachments = payload.attachments || [] // list of urls
    const sender = payload.from
      ? '"' + payload.from.name + '" <' + payload.from.user_email + '>'
      : self.application.config.gmail.sender
    let html = null
    let template = null
    let data = null
    let result = null
    let url = null
    let b64data = null
    let filename = null

    return new Promise(async (resolve, reject) => {
      // mandatory run this PRIOR trying to execute any job
      if (!self.isValidJob(job, msg)) {
        resolve({ error: 'not valid task', data: null})
        return
      }

      for (let x = 0; x < attachments.length; x++) {
        url = attachments[x]
        try {
          b64data = await fetch_base64.auto(url)
          filename = url.split('/')[url.split('/').length - 1]
          _attachments.push({
            cid: filename,
            filename: filename,
            content: b64data[0],
            encoding: 'base64'
          })
        } catch (e) {
          console.info(e)
        }
      }

      html = fs.readFileSync(
        self.application.config.app.base + '/templates/email.html',
        'utf8'
      )
      template = handlebars.compile(html.toString())
      data = {
        title: subject,
        subject: subject,
        message: message.job
          ? formatMessage(message.job, message.data)
          : message
      }
      result = template(data)
      gMailOpt = mailOptions(sender, to, subject, result, _attachments, bcc)

      self.transporter.sendMail(gMailOpt, (error, info) => {
        // console.info(error, info)
        if (error) {
          self.jobNotDone(
            job,
            msg,
            `Error sending email through Gmail. ${error.message}`
          )
          resolve({ error, data: null })
          return
        }
        self.jobDone(job, info, msg)
        resolve({ data: info, error: null })
      }) // end transporter.sendMail
    })
  }
}

export default Gmail
