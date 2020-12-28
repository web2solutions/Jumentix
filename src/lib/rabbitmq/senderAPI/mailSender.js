import RabbitEnvelop from '../../RabbitEnvelop'

export async function mailSender (email, subject, message) {
  const self = this
  try {
    const gmailJob = new RabbitEnvelop({
      from: self.getServerUser(),
      payload: {
        to: email, // email list separated by comma
        subject: subject,
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
