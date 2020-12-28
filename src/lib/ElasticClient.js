'use strict'

import { Client /* ,errors */ } from '@elastic/elasticsearch'

// mixin
const ElasticClient = (ElasticClient) =>
  class extends ElasticClient {
    async startElastic () {
      const error = false
      this.console.info(' Starting Elastic Client')
      // console.log(errors)
      const elasticClientConnection = await this.connectElastic()
      if (elasticClientConnection.error) {
        return {
          error: elasticClientConnection.error,
          elastic: false
        }
      }
      this.console.info(' =====> Elastic Client is ready')
      return {
        error,
        elastic: this.$elastic
      }
    }

    async connectElastic () {
      let error = false
      // console.error(this.config.elastic)
      try {
        this.$elastic = new Client(this.config.elastic)
      } catch (e) {
        this.console.warn(`Elastic-> connection error: details->${e}`)
        error = e
      }
      return {
        error,
        elastic: this.$elastic
      }
    }

    async stopElastic () {
      let error = false
      try {
        this.console.info(' Elastic Client is stopped')
      } catch (e) {
        this.console.warn(`${e}`)
        error = e
      }
      return {
        error
      }
    }
  }

export default ElasticClient
