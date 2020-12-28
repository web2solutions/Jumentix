export async function notifyMediator (msg) {
  const self = this
  try {
    const response = await self.sender.send.messageToQueue(
      self.config.mq.notifyMediatorQueue,
      msg
    )
    return response
  } catch (e) {
    self.console.warn('error in notifyMediator')
    self.console.error(e.message)
    return {
      sent: false,
      error: e.message || e,
      status: 500
    }
  }
}
