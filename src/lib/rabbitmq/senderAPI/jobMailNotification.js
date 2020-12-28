
import moment from 'moment-timezone'
import RabbitEnvelop from '../../RabbitEnvelop'

const pkg = require('../../../../package.json')

export async function jobMailNotification (c) {
  const self = this
  const job = c.job
  // console.log(c.data)
  const message = `
    <h1>Job execution report:</h1>
    <p style="margin: 30px 0 30px 0;">
        ${c.job.from.name} executed ${c.job.action} against ${c.job.entity} on ${moment.tz(c.job.createdAt, c.job.from.timezone).calendar()}
    </p>
    <h1>Job Request:</h1>
    <p style="margin: 30px 0 30px 0;">
        ${JSON.stringify(c.job)}
    </p>
    <h1>Job Payload:</h1>
    <p style="margin: 30px 0 30px 0;">
        ${JSON.stringify(c.job.payload)}
    </p>
    <h1>Result:</h1>
    <p style="margin: 30px 0 30px 0;">
        ${JSON.stringify(c.data)}
    </p>
   `
  // console.log(message)
  try {
    const gmailJob = new RabbitEnvelop({
      from: c.job.from,
      payload: {
        to: c.job.from.user_email, // email list separated by comma
        bcc: pkg.author.email +
          ', ' +
          pkg.contributors
            .map(function (user) {
              return user.email
            })
            .join(', '),
        subject: `Job execution report: ${c.job.from.name}, ${c.job.entity} - ${c.job.action} ${job.uuid}`,
        message: message
      },
      entity: 'Gmail',
      action: 'send'
    })
    self.channelSender.sendToQueue(
      self.config.mq.mailQueue,
      Buffer.from(JSON.stringify(gmailJob)), {
        persistent: true
      }
    )
  } catch (e) {
    self.console.warn('send mail ERROR')
    self.console.warn(e)
  }
}
