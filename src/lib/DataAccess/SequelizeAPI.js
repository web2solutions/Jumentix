'use strict'

import { isDefined } from '../util'

/** mixin representing the SequelizeAPI. */
const SequelizeAPI = (SequelizeAPI) =>
  class extends SequelizeAPI {
    async _createSequelize(job) {
      if (!isDefined(job.payload)) {
        return {
          error: 'Please provide a payload',
          status: 400
        }
      }
      if (!isDefined(job.from.userId)) {
        return {
          error: 'job.from.userId must be provided',
          status: 400
        }
      }

      let payload = job.payload,
        userId = job.from.userId,
        error = false,
        data = false

      if (isDefined(payload._history)) {
        delete payload._history
      }

      if (isDefined(payload[this.primaryKeyName])) {
        delete payload[this.primaryKeyName]
      }

      if (isDefined(payload.__v)) {
        delete payload.__v
      }

      if (isDefined(payload.deleted)) {
        delete payload.deleted
      }

      payload.createdBy = userId

      try {
        data = await this.application.$models.sequelize[this.entity].create(
          payload
        )
      } catch (err) {
        error = err.message || err
      } finally {
        return {
          error,
          data,
          status: 200
        }
      }
    }
    async _updateSequelize(job) {
      job.payload = job.payload || {}

      let payload = job.payload,
        primaryKeyValue = payload[this.primaryKeyName],
        userId = job.from.userId,
        str = null,
        old_record = null,
        data = false,
        error = false,
        old_history = false

      if (!job.payload[this.primaryKeyName]) {
        return {
          error: `Payload must have an ${this.primaryKeyName} to call findByPk`,
          status: 400
        }
      }
      if (!isDefined(job.from.userId)) {
        return {
          error: `job.from.userId must be provided`,
          status: 400
        }
      }

      payload.createdBy = userId

      try {
        data = await this.application.$models.sequelize[this.entity].findByPk(
          primaryKeyValue
        )
        if (!data) {
          return {
            error: `Record not found on Sequelize ${this.entity} table`,
            status: 404
          }
        } else {
          if (data.deleted) {
            return {
              error: `Record is deleted`,
              status: 404
            }
          }

          str = JSON.stringify(data)
          old_record = JSON.parse(str)
          old_history = JSON.parse(old_record._history)
          delete old_record._history

          // handle payload
          if (isDefined(payload._history)) {
            delete payload._history
          }

          if (isDefined(payload[this.primaryKeyName])) {
            delete payload[this.primaryKeyName]
          }

          if (isDefined(payload.__v)) {
            delete payload.__v
          }

          if (isDefined(payload.deleted)) {
            delete payload.deleted
          }

          if (isDefined(payload.createdBy)) {
            delete payload.createdBy
          }

          old_history.push(old_record)

          payload._history = JSON.stringify(old_history)
          payload.__v = parseInt(old_record.__v) + 1
          delete payload.createdBy
          payload.updatedBy = userId
          payload.updatedAt = Date.now()

          data = await data.update(payload)
        }
      } catch (err) {
        error = err.message || err
      }
      return {
        error,
        data,
        status: 200
      }
    }
    async _deleteSequelize(job) {
      job.payload = job.payload || {}

      let payload = job.payload,
        primaryKeyValue = payload[this.primaryKeyName],
        userId = job.from.userId,
        str = null,
        old_record = null,
        data = false,
        error = false,
        old_history = false,
        payload_delete = {}

      if (!job.payload[this.primaryKeyName]) {
        return {
          error: `Payload must have an ${this.primaryKeyName} to call findByPk`,
          status: 400
        }
      }
      if (!isDefined(job.from.userId)) {
        return {
          error: `job.from.userId must be provided`,
          status: 400
        }
      }

      try {
        data = await this.application.$models.sequelize[this.entity].findByPk(
          primaryKeyValue
        )
        if (!data) {
          return {
            error: `Record not found on Sequelize ${this.entity} table`,
            status: 404
          }
        } else {
          if (data.deleted) {
            return {
              error: `Record is deleted`,
              status: 404
            }
          }

          str = JSON.stringify(data)
          old_record = JSON.parse(str)
          old_history = JSON.parse(old_record._history)
          delete old_record._history

          old_history.push(old_record)

          payload_delete._history = JSON.stringify(old_history)

          payload_delete.deleted = true
          payload_delete.active = false
          delete payload_delete.createdBy
          payload_delete.updatedBy = userId
          payload_delete.updatedAt = Date.now()
          payload_delete.__v = parseInt(old_record.__v) + 1

          data = await data.update(payload_delete)
        }
      } catch (err) {
        error = err.message || err
      }

      return {
        error,
        data,
        status: 200
      }
    }

    async _deleteHardSequelize(job) {
      job.payload = job.payload || {}

      let payload = job.payload,
        primaryKeyValue = payload[this.primaryKeyName],
        userId = job.from.userId,
        str = null,
        old_record = null,
        data = false,
        error = false,
        old_history = false,
        payload_delete = {}

      if (!job.payload[this.primaryKeyName]) {
        return {
          error: `Payload must have an ${this.primaryKeyName} to call findByPk`,
          status: 400
        }
      }

      try {
        data = await this.application.$models.sequelize[this.entity].findByPk(
          primaryKeyValue
        )
        if (!data) {
          return {
            error: `Record not found on Sequelize ${this.entity} table`,
            status: 404
          }
        } else {
          if (data.deleted) {
            return {
              error: `Record is deleted`,
              status: 404
            }
          }

          str = JSON.stringify(data)
          old_record = JSON.parse(str)
          old_history = JSON.parse(old_record._history)
          delete old_record._history

          old_history.push(old_record)

          payload_delete._history = JSON.stringify(old_history)

          payload_delete.deleted = true
          payload_delete.active = false
          // payload_delete.createdBy  = userId
          delete payload_delete.createdBy
          payload_delete.updatedBy = userId
          payload_delete.updatedAt = Date.now()
          payload_delete.__v = parseInt(old_record.__v) + 1

          data = await data.update(payload_delete)
        }
      } catch (err) {
        error = err.message || err
      }

      return {
        error,
        data,
        status: 200
      }
    }

    async _restoreSequelize(job) {
      job.payload = job.payload || {}

      let payload = job.payload,
        primaryKeyValue = payload[this.primaryKeyName],
        userId = job.from.userId,
        str = null,
        old_record = null,
        data = false,
        error = false,
        old_history = false,
        payload_delete = {}

      if (!job.payload[this.primaryKeyName]) {
        return {
          error: `Payload must have an ${this.primaryKeyName} to call findByPk`,
          status: 400
        }
      }

      try {
        data = await this.application.$models.sequelize[this.entity].findByPk(
          primaryKeyValue
        )
        if (!data) {
          return {
            error: `Record not found on Sequelize ${this.entity} table`,
            status: 404
          }
        } else {
          if (data.deleted) {
            return {
              error: `Record is deleted`,
              status: 404
            }
          }

          str = JSON.stringify(data)
          old_record = JSON.parse(str)
          old_history = JSON.parse(old_record._history)
          delete old_record._history

          old_history.push(old_record)

          payload_delete._history = JSON.stringify(old_history)

          payload_delete.deleted = false
          payload_delete.active = true
          delete payload_delete.createdBy
          payload_delete.updatedBy = userId
          payload_delete.updatedAt = Date.now()
          payload_delete.__v = parseInt(old_record.__v) + 1

          data = await data.update(payload_delete)
        }
      } catch (err) {
        error = err.message || err
      }

      return {
        error,
        data,
        status: 200
      }
    }

    async _getSequelizeRecordById(job) {
      job.payload = job.payload || {}

      if (!isDefined(job.from.userId)) {
        return {
          error: `job.from.userId must be provided`,
          status: 400
        }
      }
      if (!job.payload[this.primaryKeyName]) {
        return {
          error: `Payload must have an ${this.primaryKeyName} to call _getSequelizeRecordById`,
          status: 400
        }
      }

      let primaryKeyValue = job.payload[this.primaryKeyName] || false,
        include = job.payload.include || false,
        attributes = job.payload.attributes || false,
        table = job.payload.table || this.entity,
        data = false,
        error = false,
        where = {}

      where[this.primaryKeyName] = primaryKeyValue
      where.deleted = false

      if (!job.payload[this.primaryKeyName]) {
        return {
          error: `Payload must have an ${this.primaryKeyName} to call findByPk`,
          status: 400
        }
      }

      try {
        if (include && !attributes) {
          data = await this.application.$models.sequelize[table].findOne({
            where,
            include
          })
        } else if (!include && attributes) {
          data = await this.application.$models.sequelize[table].findOne({
            where,
            attributes
          })
        } else if (include && attributes) {
          data = await this.application.$models.sequelize[table].findOne({
            where,
            attributes,
            include
          })
        } else {
          data = await this.application.$models.sequelize[table].findOne({
            where
          })
        }
      } catch (err) {
        error = err.message || err
      }

      if (data === null) {
        return {
          error: `Record not found on Sequelize ${table} table`,
          status: 404
        }
      }

      return {
        error,
        data,
        status: 200
      }
    }
    async _getAllSequelize(job) {
      job.payload = job.payload || {}

      if (!isDefined(job.from.userId)) {
        return {
          error: `job.from.userId must be provided`,
          status: 400
        }
      }

      let where = job.payload.where || {},
        include = job.payload.include || false,
        attributes = job.payload.attributes || false,
        table = job.payload.table || this.entity,
        error = false,
        data = null

      // exclude deleted records
      where.deleted = false

      try {
        if (include && !attributes) {
          data = await this.application.$models.sequelize[
            table
          ].findAndCountAll({ where, include /* , offset: 10, limit: 2*/ })
        } else if (!include && attributes) {
          data = await this.application.$models.sequelize[
            table
          ].findAndCountAll({ where, attributes /* , offset: 10, limit: 2*/ })
        } else if (include && attributes) {
          data = await this.application.$models.sequelize[
            table
          ].findAndCountAll({
            where,
            attributes,
            include /* , offset: 10, limit: 2*/
          })
        } else {
          data = await this.application.$models.sequelize[
            table
          ].findAndCountAll({ where /* , offset: 10, limit: 2*/ })
        }
      } catch (err) {
        error = err.message || err
      }

      /* if (data === null)
            return {
                error: `Record not found on Sequelize ${ table } table`,
                status: 404
            }*/

      return {
        error,
        data: data.rows || [],
        count: data.count || 0,
        pages: 0, //
        limit: 0, //
        page: 0, //
        status: 200
      }
    }
    async _getOneSequelize(job) {
      job.payload = job.payload || {}

      if (!isDefined(job.from.userId)) {
        return {
          error: `job.from.userId must be provided`,
          status: 400
        }
      }

      let where = job.payload.where || {},
        include = job.payload.include || false,
        attributes = job.payload.attributes || false,
        table = job.payload.table || this.entity,
        error = false,
        data = null

      // exclude deleted records
      where.deleted = false

      try {
        if (include && !attributes) {
          data = await this.application.$models.sequelize[table].findOne({
            where,
            include
          })
        } else if (!include && attributes) {
          data = await this.application.$models.sequelize[table].findOne({
            where,
            attributes
          })
        } else if (include && attributes) {
          data = await this.application.$models.sequelize[table].findOne({
            where,
            attributes,
            include
          })
        } else {
          data = await this.application.$models.sequelize[table].findOne({
            where
          })
        }
      } catch (err) {
        error = err.message || err
      }

      if (data === null) {
        return {
          error: `Record not found on Sequelize ${table} table`,
          status: 404
        }
      }

      return {
        error,
        data,
        status: 200
      }
    }
  }

export default SequelizeAPI
