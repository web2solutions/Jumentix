'use strict'
import nodemailer from 'nodemailer'
import mg from 'nodemailer-mailgun-transport'
import fetch_base64 from 'fetch-base64'
import handlebars from 'handlebars'
import fs from 'fs'
import Service from '../Job/Service' // mandatory
import { mailOptions, decodeString, formatMessage } from '../util'

/**
 * Class representing a Mailgun Service
 * @extends Service
 */
class Mailgun extends Service {
  /**
   * Creates a Mailgun Service
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor(application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call
    let self = this
    this.entity = 'Mailgun'
    // console.info('this.application.config', this.application.config.mailgun)
    this.fromSender = this.application.config.mailgun.sender
    this.transporter = nodemailer.createTransport(
      mg({
        auth: {
          api_key: this.application.config.mailgun.api_key,
          domain: this.application.config.mailgun.domain
        }
        // proxy: false // 'http://user:pass@localhost:8080' // optional proxy, default is false
      })
    )

    // self.application.config.mq.isSendClientMail = false
  }

  send(job, msg) {
    let self = this,
      payload = job.payload, // payload is the resource information associated to this task data
      gMailOpt = null,
      _attachments = [],
      subject = payload.subject,
      message = payload.message,
      to = payload.to,
      bcc = payload.bcc || '',
      attachments = payload.attachments || [], // list of urls
      sender = payload.from
        ? '"' + payload.from.name + '" <' + payload.from.user_email + '>'
        : self.application.config.mailgun.sender,
      html = null,
      template = null,
      data = null,
      result = null,
      url = null,
      b64data = null,
      filename = null

    return new Promise(async (resolve, reject) => {
      // mandatory run this PRIOR trying to execute any job
      if (!self.isValidJob(job, msg)) {
        reject('not valid task')
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
            `Error sending email through Mailgun. ${error.message}`
          )
          reject(Error(error))
          return
        }
        self.jobDone(job, info, msg)
        resolve(info)
      }) // end transporter.sendMail
    })
  }
}

export default Mailgun
