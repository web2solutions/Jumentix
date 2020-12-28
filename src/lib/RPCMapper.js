'use strict'

// import chalk from 'chalk'
import fs from 'fs'
import config from '../config/'

const env = process.env.NODE_ENV || 'development'

class RPCMapper {
  constructor (application) {
    this.application = application
    this.services = {}
    // console.log(this.application.c)
  }

  async mapServices () {
    const self = this
    try {
      const files = fs.readdirSync(`${config[env].base}/services`)
      for (const i in files) {
        if (
          files[i].indexOf('.js') > -1 &&
          files[i].indexOf('index') === -1
        ) {
          const filename = files[i]
            .replace(/\.js/gi, '')
            .replace(/\.model/gi, '')
          const module = require(`${config[env].base}/services/${files[i]}`)
          const ClassObject = module.default
          self.services[filename] = new ClassObject(self.application)
          const entityDir = self.application.cdnDIR + filename + '/'
          self.services[filename].entityDir = entityDir
          self.services[filename].webPath = '/cdn/' + filename + '/'
          // console.log(entityDir)
          // this.entityDir = this.application.cdnDIR + this.entity + '/'
          fs.existsSync(entityDir) || fs.mkdirSync(entityDir)
        }
      }
      return { status: 'ok', error: null }
    } catch (e) {
      console.log(`Error ${e}`)
      self.application.console.error(`${e}`)
      return { status: null, error: e }
    }
  }

  execute (job, msg) {
    const self = this
    const action = self.application.c.jobLogReader ? 'create' : job.action
    const entity = self.application.c.jobLogReader ? 'JobLog' : job.entity

    this.application.console.info(
      ' Trying to execute ' + action + ' RPC in ' + entity + ' now '
    )
    this.application.console.info(' entity: ' + entity)
    this.application.console.info(' RPC name: ' + action)

    if (this.services[entity]) {
      if (this.services[entity][action]) {
        ;(async () => {
          try {
            await self.services[entity][action](job, msg)
          } catch (e) {
            console.log(e)
            self.application.console.warn('error executing rpc')
            self.application.console.error(e)
          }
        })()
        return
      } else {
        this.application.console.error(action + ' RPC function not found')
      }
    } else {
      this.application.console.error(entity + ' RPC service Entity not found')
    }
    // once this message is not specifying a valid RPC name, lets remove it from queue
    this.application.channel.ack(msg)
  }
}

export default RPCMapper
