import {
  isDefined
} from '../../util'

export async function messageToQueue (queue, msg) {
  const self = this
  if (!isDefined(msg)) {
    return {
      sent: false,
      error: 'msg is mandatory',
      status: 500
    }
  }

  await self.channelSender.assertQueue(queue, {
    durable: true
  })
  // console.log(msg)
  const correlationId = msg.uuid
  const messageId = correlationId
  const appId = msg.source
  const opt = {
    persistent: true,
    correlationId,
    mandatory: true,
    messageId,
    appId
  }

  self.channelSender.sendToQueue(
    queue,
    Buffer.from(JSON.stringify(msg)),
    opt,
    function (err, ok) {
      // console.log('>>>>>>>>>')
      // console.log(err, ok)
      if (err !== null) {
        return {
          sent: false,
          error: err,
          status: 500
        }
      }
      return {
        sent: true,
        error: false,
        status: 200
      }
    }
  )
}
