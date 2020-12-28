'use strict'

import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'
// import chalk from 'chalk'

const env = process.env.NODE_ENV || 'development'
const config = require(path.join(__dirname, '..', 'config', 'config.json'))[env]
// mixin
const SequelizeClient = (SequelizeClient) =>
  class extends SequelizeClient {
    async startSequelize () {
      const self = this
      await self._startSequelize()
    }

    async _startSequelize () {
      try {
        this.console.info(' Starting Sequelize ' + config.dialect + ' Client')
        if (config.dialect === 'mssql') {
          Sequelize.DATE.prototype._stringify = function _stringify (
            date,
            options
          ) {
            date = this._applyTimezone(date, options)
            // Z here means current timezone, not UTC
            // return date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
            return date.format('YYYY-MM-DD HH:mm:ss.SSS')
          }
        }

        const Op = Sequelize.Op

        this.db = {
          Op: Op,
          operatorsAliases: {
            $gt: Op.gt
          },
          sequelize: null,
          Sequelize: Sequelize // ,
          // models: {}
        }

        const { error /* , success */ } = await this.connectSequelize()
        if (error) {
          this.console.error('MSSQL onnection error: ' + error)
          this.console.info('Reconnecting to MSSQL ...')
          await this._startSequelize()
        } else {
          this.console.info(
            ' Sequelize ' + config.dialect + ' Client is ready'
          )
          return true
        }
      } catch (err) {
        this.console.error('MSSQL onnection error: ' + err.message)
        this.console.info('Reconnecting to MSSQL ...')
        await this._startSequelize()
      }
    }

    async connectSequelize () {
      let error = false
      let success = false
      try {
        this.db.sequelize = new Sequelize(
          config.database,
          config.username,
          config.password,
          config
        )
        await this.mapSequelizeModels()
        await this.db.sequelize.sync()
        success = true
      } catch (err) {
        error = err.message
      }

      return {
        error,
        success
      }
    }

    async stopSequelizeDB () {
      const self = this
      try {
        self.$db.close()
        return true
      } catch (err) {
        self.console.error(`${err}`)
        return false
      }
    }

    async mapSequelizeModels () {
      const self = this
      try {
        fs.readdirSync(__dirname + '/models/sequelize')
          .filter((file) => {
            return file.indexOf('.') !== 0 && file !== 'index.js'
          })
          .forEach((file) => {
            const model = self.db.sequelize.import(
              path.join(__dirname + '/models/sequelize', file)
            )
            self.$models.sequelize[model.name] = model
          })

        Object.keys(self.$models.sequelize).forEach((modelName) => {
          if ('associate' in self.$models.sequelize[modelName]) {
            self.$models.sequelize[modelName].associate(
              self.$models.sequelize
            )
          }
        })

        return true
      } catch (err) {
        self.console.error(`${err}`)
        return false
      }
    }
  }

export default SequelizeClient
