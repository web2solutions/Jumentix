'use strict'

import Riak from 'basho-riak-client'

// mixin
const RiakClient = (RiakClient) =>
  class extends RiakClient {
    async startRiak () {
      const error = false
      this.console.info(' Starting Riak Client')
      this.riakNodes = [
        'riak-test:10017',
        'riak-test:10027',
        'riak-test:10037',
        'riak-test:10047'
      ]
      // const node = new Riak.Node({remoteAddress: 'riak-test', remotePort: 10017});
      // const cluster = new Riak.Cluster({nodes: [node]});
      const riakClientConnectionResponse = await this.connectRiak()
      if (riakClientConnectionResponse.error) {
        return {
          error: riakClientConnectionResponse.error,
          riak: false
        }
      }
      this.console.info(' =====> Riak Client is ready')
      return {
        error,
        riak: this.$riak
      }
    }

    connectRiak () {
      // console.error(this.config.riak)
      return new Promise((resolve, reject) => {
        this.$riak = new Riak.Client(this.nodes, function (error, c) {
          if (error) {
            return resolve({
              error,
              riak: c
            })
          }
          return resolve({
            error: null,
            riak: c
          })
        })
      })
    }

    stopRiak () {
      return new Promise((resolve, reject) => {
        this.$riak.shutdown((state) => {
          if (state === Riak.Cluster.State.SHUTDOWN) {
            resolve({
              error: null,
              riak: this.$riak
            })
          }
        })
      })
    }

    riakCreate ({ bucket = '', key = '', value = '' }) {
      return new Promise((resolve, reject) => {
        if (bucket === '') {
          resolve({ error: 'bucket is missing', data: null })
        }
        if (key === '') {
          resolve({ error: 'key is missing', data: null })
        }
        if (value === '') {
          resolve({ error: 'value is missing', data: null })
        }
        this.$riak.storeValue({
          bucket,
          key,
          value
        }, function (error, data) {
          resolve({ error, data })
        })
      })
    }

    riakRead ({ bucket = '', key = '', convertToJs = true }) {
      return new Promise((resolve, reject) => {
        if (bucket === '') {
          resolve({ error: 'bucket is missing', data: null })
        }
        if (key === '') {
          resolve({ error: 'key is missing', data: null })
        }
        this.$riak.fetchValue({
          bucket,
          key,
          convertToJs: true
        }, function (error, rslt) {
          if (error) {
            return resolve({ error, data: null })
          }
          const riakObj = rslt.values.shift()
          const data = riakObj.value
          return resolve({ error: null, data })
        })
      })
    }

    riakDelete ({ bucket = '', key = '' }) {
      return new Promise((resolve, reject) => {
        if (bucket === '') {
          resolve({ error: 'bucket is missing', data: null })
        }
        if (key === '') {
          resolve({ error: 'key is missing', data: null })
        }
        this.$riak.deleteValue({
          bucket,
          key
        }, function (error, rslt) {
          if (error) {
            return resolve({ error, data: null })
          }
          // const riakObj = rslt.values.shift()
          // const data = riakObj.value
          return resolve({ error: null, data: rslt })
        })
      })
    }
  }

export default RiakClient
