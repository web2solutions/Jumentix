'use strict'

import redis from 'redis'
import {
  // findIndex,
  // copy,
  isArray
} from './util'

// mixin
const RedisClient = (RedisClient) =>
  class extends RedisClient {
    async startRedis (c) {
      const self = this
      const error = false
      c = c || {}
      try {
        self.console.info(' Starting Redis Client')
        self.redis = {
          store: false,
          pub: false,
          sub: false
        }

        await self.connectRedis(c)
        self.console.info(' Redis Client is ready')
        return {
          error,
          redis: self.redis
        }
      } catch (e) {
        self.console.error(` Could not start redis ${e.message}`)
        console.log(e)
        return {
          error: e,
          redis: false
        }
      }
    }

    async connectRedis (c) {
      const self = this
      const error = false
      try {
        self.redis.store = redis.createClient(self.config.redis)
        if (c.pubSub) {
          self.redis.pub = redis.createClient(self.config.redis)
          self.redis.sub = redis.createClient(self.config.redis)
        }
        await self.setStoreEvents(c)
        return {
          error,
          redis: self.redis
        }
      } catch (e) {
        self.console.error(`Could not connect to redis ${e.message}`)
        return {
          error: e,
          redis: false
        }
      }
    }

    setStoreEvents (c) {
      const self = this
      const needread = 3
      let alreadyReady = 0

      return new Promise((resolve, reject) => {
        try {
          self.redis.store.on('error', function (err) {
            self.console.warn('Redis - error.' + err)
          })

          self.redis.store.on('connect', function (msg) {
            self.console.info('     Redis connection is estabilished')
          })

          self.redis.store.on('ready', async function (msg) {
            self.console.info('     Redis store client is ready')

            if (c.pubSub) {
              self.redis.store.set(self.config.app.onLineUsersStorageName, '[]')

              const { error, data } = await self.getRedisKey(
                self.config.app.channelsStorageName
              )
              if (error) {
                alreadyReady += 1
                if (alreadyReady === needread) {
                  resolve(false)
                }
              } else {
                let channels = data ? JSON.parse(data) : '[]'
                if (!isArray(channels)) {
                  channels = []
                }
                self.channels = channels
                self.redis.store.set(
                  self.config.app.channelsStorageName,
                  JSON.stringify(channels)
                )
                // go to next item from API stack
                alreadyReady += 1
                if (alreadyReady === needread) {
                  resolve(true)
                }
              }
            } else {
              resolve(true)
            }
          })

          self.redis.store.on('disconnected', async function (msg) {
            self.console.warn('Redis - disconnected event.' + msg)
            await self.serviceStop()
          })

          self.redis.store.on('reconnecting', function (msg) {
            self.console.warn('Redis - reconnecting event.' + msg)
          })

          self.redis.store.on('reconnected', function (msg) {
            self.console.info('Redis - reconnected event.' + msg)
          })

          self.redis.store.on('noconnection', async function (msg) {
            self.console.warn('Redis - noconnection event.' + msg)
            await self.serviceStop()
          })

          if (c.pubSub) {
            self.redis.pub.on('ready', function (msg) {
              self.console.info('     Redis publisher client is ready')

              // go to next item from API stack
              alreadyReady += 1
              if (alreadyReady === 3) {
                resolve(true)
              }
            })

            self.redis.sub.on('ready', function (msg) {
              self.console.info('     Redis subscriber client is ready')

              // go to next item from API stack
              alreadyReady += 1
              if (alreadyReady === needread) {
                resolve(true)
              }
            })
          }
        } catch (e) {
          self.console.error(`Could not set redis events ${e.message}`)
          reject(e)
        }
      })
    }

    stopRedis () {
      const self = this
      return new Promise((resolve, reject) => {
        try {
          if (self.redis.pub) {
            self.redis.store.quit(() => {
              self.console.info(' RedisStore Client is stopped')
              // console.log('redis store closed')
              self.redis.pub.quit(() => {
                // console.log('redis publisher closed')
                self.console.info(' RedisPub Client is stopped')
                self.redis.sub.quit(() => {
                  // console.log('redis subscriber closed')
                  self.console.info(' RedisSub Client is stopped')
                  resolve()
                })
              })
            })
          } else {
            self.redis.store.quit(() => {
              self.console.info(' RedisStore Client is stopped')
              resolve()
            })
          }
        } catch (e) {
          self.console.error(`Could not stop redis ${e.message}`)
          reject(e)
        }
      })
    }

    getRedisKey (key) {
      const self = this
      return new Promise(function (resolve, reject) {
        try {
          self.redis.store.get(key, (err, data) => {
            if (err) {
              resolve({
                error: err,
                data: null
              })
            }
            // if no match found
            if (data !== null) {
              resolve({
                error: null,
                data: data
              })
            } else {
              // proceed to next middleware function
              resolve({
                error: 'no data',
                data: null
              })
            }
          })
        } catch (e) {
          self.console.error(`Could not start redis ${e.message}`)
          resolve({
            error: e,
            data: null
          })
        }
      })
    }

    getRedisHkey (hashName, key) {
      const self = this
      return new Promise(function (resolve, reject) {
        try {
          self.redis.store.hget(hashName, key, (err, data) => {
            if (err) {
              resolve({
                error: err,
                data: null
              })
            }
            // if no match found
            if (data !== null) {
              resolve({
                error: null,
                data: data
              })
            } else {
              // proceed to next middleware function
              resolve({
                error: 'no data',
                data: null
              })
            }
          })
        } catch (e) {
          self.console.error(`Could not start redis ${e.message}`)
          resolve({
            error: e,
            data: null
          })
        }
      })
    }

    clearKey (hashName) {
      const self = this
      self.redis.store.del(JSON.stringify(hashName))
    }
  }

export default RedisClient
