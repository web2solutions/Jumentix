import RabbitEnvelop from '../../RabbitEnvelop'

const pkg = require('../../../../package.json')

export async function alert (subject, message) {
  const self = this
  try {
    const gmailEmailTask = new RabbitEnvelop({
      from: self.getServerUser(),
      payload: {
        to: pkg.author.email +
          ', ' +
          pkg.contributors
            .map(function (user) {
              return user.email
            })
            .join(', '), // email list separated by comma
        subject: subject,
        message: message
      },
      entity: 'Gmail',
      action: 'send'
    })
    // console.log(` gmailEmailTask `)
    // console.log( gmailEmailTask )
    self.channelSender.sendToQueue(
      self.config.mq.alertNotificationQueue,
      Buffer.from(JSON.stringify(gmailEmailTask)), {
        persistent: true
      }
    )
  } catch (e) {
    self.console.warn('send alert ERROR')
    self.console.warn(e)
  }
}
