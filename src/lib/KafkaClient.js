'use strict'



// mixin
const KafkaClient = (KafkaClient) =>
  class extends KafkaClient {
    async startKafka () {
      const error = false
      this.console.info(' Starting Kafka Client')
      // console.log(errors)
      const kafkaClientConnection = await this.connectKafka()
      if (kafkaClientConnection.error) {
        return {
          error: kafkaClientConnection.error,
          kafka: false
        }
      }
      this.console.info(' =====> Kafka Client is ready')
      return {
        error,
        kafka: this.$kafka
      }
    }

    async connectKafka () {
      let error = false
      // console.error(this.config.kafka)
      try {
        // this.$kafka = new Client(this.config.kafka)
      } catch (e) {
        // this.console.warn(`Kafka-> connection error: details->${e}`)
        error = e
      }
      return {
        error,
        kafka: this.$kafka
      }
    }

    async stopKafka () {
      let error = false
      try {
        this.console.info(' Kafka Client is stopped')
      } catch (e) {
        this.console.warn(`${e}`)
        error = e
      }
      return {
        error
      }
    }
  }

export default KafkaClient
