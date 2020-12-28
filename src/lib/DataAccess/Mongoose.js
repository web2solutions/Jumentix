'use strict'
import {
  sanitizePayload,
  isArray
} from '../util'
/**
 * Implements a unified data API to consume multiple database engines
 * Currently implemented: Mongoose and Sequelize
 * @class
 */
class MongooseMapper {
  /**
   * Creates Mongoose Service interface
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor ({ application, entity, primaryKeyName }) {
    this.application = application
    this.entity = entity
    this.primaryKeyName = primaryKeyName
  }

  log (arg1, arg2 = false) {
    arg2 ? console.log(arg1, arg2) : console.log(arg1)
  }

  async create (job) {
    const payload = sanitizePayload(job.payload, job)
    let error = false
    let record = false
    const userId = job.from.human._id
    if (userId !== '0' && userId !== 0) {
      payload.createdBy = userId
    }
    try {
      record = await this.application.$models.mongoose[this.entity].create(
        isArray(payload) ? payload : [payload]
      )
      this.application.clearKey(this.entity)
    } catch (err) {
      this.log(err.message, error)
      error = err
    }

    return {
      error,
      data: isArray(payload) ? record : record[0],
      status: error ? 500 : 201
    }
  }

  async update (job) {
    const payload = sanitizePayload(job.payload, job)
    const primaryKeyValue = payload[this.primaryKeyName]
    const userId = job.from.human._id
    let error = false
    let record = false
    let data = false
    let status = 500
    const query = {
      _id: primaryKeyValue
    }
    const options = {
      new: true
    }

    payload.updatedAt = new Date(Date.now()).toString()
    if (userId !== '0' && userId !== 0) {
      payload.updatedBy = userId
    }

    try {
      record = await this.application.$models.mongoose[this.entity].findById(
        primaryKeyValue
      )
      if (!record) {
        error = `Record not found on Mongo ${this.entity} collection`
        status = 404
      } else if (record.deleted) {
        error = 'Record is deleted and can not be updated'
        status = 403
      } else {
        data = await this.application.$models.mongoose[
          this.entity
        ].findOneAndUpdate(query, payload, options)
        status = 200
        this.application.clearKey(this.entity)
      }
    } catch (err) {
      console.log(err.message, error)
      error = err
      status = 500
    }

    return {
      error,
      data,
      status
    }
  }

  async addSubDocument (job) {
    
  }

  async editSubDocument (job) {
    
  }

  async deleteSubDocument (job) {
    
  }

  //

  async addFile (job) {
    
  }

  async deleteFile (job) {
    
  }

  async delete (job) {
    
  }

  async deleteHard (job) {
    
  }

  async restore (job) {
    
  }

  async getById (job) {
    
  }

  async getAll (job) {
    
  }

  async getOne (job) {
    
  }
}

export default MongooseMapper
