export async function log (msg) {
  const self = this
  self.channelSender.sendToQueue(
    self.config.mq.jobLogQueue,
    Buffer.from(JSON.stringify(msg)), {
      persistent: true
    }
  )
}
