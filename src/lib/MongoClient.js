'use strict'

import mongoose from 'mongoose'
import fs from 'fs'
import config from '../config/'
const env = process.env.NODE_ENV || 'development'
const uri = config[env].mongoose.uri
const opts = config[env].mongoose.options

mongoose.Promise = global.Promise

// mixin
const MongoClient = (MongoClient) =>
  class extends MongoClient {
    async startMongo () {
      const self = this
      const error = false

      try {
        self.console.info(' Starting MongoDB Client')

        const rCM = await self.connectMongo()
        if (rCM.error) {
          return { error: rCM.error, mongo: false }
        }

        self.console.info('     setting MongoDB events')
        const sMER = self.setMongoEvents()
        if (sMER.error) {
          return { error: sMER.error, mongo: false }
        }

        self.console.info('     setting MongoDB models')
        const mMR = self.mapModels()
        if (mMR.error) {
          return { error: mMR.error, mongo: false }
        }

        self.console.info('     planting MongoDB seeds')
        const rSR = await self.readSeeds()
        if (rSR.error) {
          return { error: rSR.error, mongo: false }
        }

        self.console.info(' MongoDB Client is ready')

        return { error, mongo: self.db }
      } catch (e) {
        self.console.warn(`MongoDB-> connection error: ${uri} details->${e}`)
        return { error: e, mongo: false }
      }
    }

    async connectMongo () {
      const self = this
      const error = false
      try {
        self.$db = mongoose

        self.$db.set('useNewUrlParser', true)
        self.$db.set('useFindAndModify', false)
        self.$db.set('useCreateIndex', true)
        self.$db.set('useUnifiedTopology', true)

        const conn = await self.$db.connect(uri, opts)
        return { error, mongo: self.db, conn }
      } catch (e) {
        self.console.warn(`MongoDB-> connection error: ${uri} details->${e}`)
        return { error: e, mongo: false }
      }
    }

    async onMongoDisconnect () {
      this.console.warn(`MongoDB-> disconnected: ${uri}`)
      await this.connectMongo()
    }

    setMongoEvents () {
      const self = this
      const error = false
      try {
        self.$db.connection.on('disconnected', async () => await this.onMongoDisconnect())

        self.$db.connection.on('reconnected', (e) => self.console.warn(`MongoDB-> reconnected: ${uri} ${e}`))

        return { error }
      } catch (e) {
        self.console.warn(`${e}`)
        return { error: e }
      }
    }

    async stopMongoDB () {
      const self = this
      try {
        self.$db.connection.close()
        self.console.info(' MongoDB Client is stopped')
        return true
      } catch (e) {
        self.console.warn(`${e}`)
        return e
      }
    }

    mapModels () {
      const self = this
      const error = false
      try {
        const files = fs.readdirSync(`${config[env].base}/models/mongoose`)
        for (const i in files) {
          if (
            files[i].indexOf('.js') > -1 &&
            files[i].indexOf('index') === -1
          ) {
            const modelname = files[i]
              .replace(/\.js/gi, '')
              .replace(/\.model/gi, '')
            const module = require(`${config[env].base}/models/mongoose/${files[i]}`)
            // self.models[ modelname ] = module[ modelname ]
            // console.log(modelname)

            self.$models.mongoose[modelname] = module[modelname]

            // self.$models.mongoose[ modelname ].createCollection();
          }
        }
        return { error }
      } catch (e) {
        self.console.warn(`${e}`)
        return { error: e }
      }
    }

    async readSeeds () {
      const self = this
      const error = false
      try {
        const files = fs.readdirSync(`${config[env].base}/models/mongoose/seeds`)
        for (const i in files) {
          if (
            files[i].indexOf('.js') > -1 &&
            files[i].indexOf('index') === -1
          ) {
            const modelname = files[i]
              .replace(/\.js/gi, '')
              .replace(/\.model/gi, '')
            const seed = require(`${config[env].base}/models/mongoose/seeds/${files[i]}`)
              .default

            if (seed.plant === 'once') {
              let count = await self.$models.mongoose[modelname].countDocuments(
                {}
              )
              count = parseInt(count)

              if (count <= 0) {
                try {
                  await self.$models.mongoose[modelname].collection.drop()
                } catch (e) {
                } finally {
                  await self.plant(modelname, seed.data)
                }
              }
            } else if (seed.plant === 'always') {
              try {
                await self.$models.mongoose[modelname].collection.drop()
              } catch (e) {
              } finally {
                await self.plant(modelname, seed.data)
              }
            }
          }
        }
        return { error, total: files.lenght }
      } catch (e) {
        self.console.warn(`${e}`)
        return { error: e, total: 0 }
      }
    }

    async plant (modelname, data) {
      const self = this
      const error = false
      self.console.info('     planting ' + modelname)
      try {
        const records = await this.$models.mongoose[modelname].create(data)
        self.console.warn(` Seed: Published ${modelname}'s!`)
        return { error, records }
      } catch (e) {
        console.log(e)
        throw Error({ error: e, records: false })
      }
    }
  }

export default MongoClient
