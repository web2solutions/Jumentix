'use strict'
import {
  isDefined
} from '../util'

/**
 * Implements a unified data API to consume multiple database engines
 * Currently implemented: Mongoose and Sequelize
 * @class
 */
class DataAPI {
  /**
   * Creates DataAPI Service interface
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor (application) {
    this.historyStore = 'elastic'
  }

  async addHistory (record) {
    let error = null
    let data = null
    try {
      if (this.historyStore === 'elastic') {
        const history = await this.application.$elastic.index({
          id: record.document_id,
          index: 'historyyyy',
          type: '_doc', // uncomment this line if you are using Elasticsearch ≤ 6
          body: record
        })
        data = history
      } else if (this.historyStore === 'cassandra') {
        const history = new this.application.$cassandra.instance.History(record)
        await history.saveAsync()
        data = history
      } else {
        throw Error('History is not being saved')
      }
    } catch (e) {
      error = e
      data = null
    }
    return { error, data }
  }

  // ======================= COMMON API
  async createRecord (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (!isDefined(job.payload)) {
      return {
        error: 'Please provide a payload',
        data: null,
        status: 400
      }
    }
    if (!isDefined(job.from.human._id)) {
      return {
        error: 'job.from.human._id must be provided',
        data: null,
        status: 400
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._createMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._createSequelize(job)
    }
    return response
  }

  async updateRecord (job) {
    let response = null
    if (!job.payload) {
      return {
        error: 'The job must have a payload.',
        data: null,
        status: 400
      }
    }
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (!job.payload[this.primaryKeyName]) {
      return {
        error: `Payload must have an ${this.primaryKeyName} to call findById`,
        status: 400
      }
    }
    if (!isDefined(job.from.human._id)) {
      return {
        error: 'job.from.human._id must be provided',
        status: 400
      }
    }
    if (!isDefined(job.payload[this.primaryKeyName])) {
      return {
        error: 'primaryKeyValue must be provided',
        status: 400
      }
    }
    if (job.payload[this.primaryKeyName] === 'undefined') {
      return {
        error: 'primaryKeyValue must be provided',
        status: 400
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._updateMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._updateSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async addSubDocument (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._addSubDocumentMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._addSubDocumentSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async editSubDocument (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._editSubDocumentMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._editSubDocumentSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async deleteSubDocument (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._deleteSubDocumentMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._deleteSubDocumentSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  //

  async addFile (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._addFileMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._addFileSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async deleteFile (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._deleteFileMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._deleteFileSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async deleteRecord (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._deleteMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._deleteSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async deleteHardRecord (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (
      job.from.roles.indexOf('admin') === -1 &&
      job.from.roles.indexOf('agency') === -1
    ) {
      return {
        error: 'You must be an admin or agency to be able to restore',
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._deleteHardMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._deleteHardSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async restoreRecord (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (
      job.from.roles.indexOf('admin') === -1 &&
      job.from.roles.indexOf('agency') === -1
    ) {
      return {
        error: 'You must be an admin or agency to be able to restore',
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      }
      response = await this._restoreMongo(job)
    } else if (this.storageEngine === 'sequelize') {
      response = await this._restoreSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async getRecordById (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      } else {
        response = await this._getMongoRecordById(job)
      }
    } else if (this.storageEngine === 'sequelize') {
      response = await this._getSequelizeRecordById(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }

  async getAllRecords (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }

    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      } else {
        response = await this._getAllMongo(job)
      }
    } else if (this.storageEngine === 'sequelize') {
      response = await this._getAllSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null,
        status: 500
      }
    }

    return response
  }

  async getOneRecord (job) {
    let response = null
    if (!job.from.active) {
      return {
        error: `The user ${job.from.name} is not active and can not read data.`,
        data: null,
        status: 403
      }
    } else if (job.from.deleted) {
      return {
        error: `The user ${job.from.name} is deleted and can not read data.`,
        data: null,
        status: 403
      }
    }
    if (this.storageEngine === 'mongo') {
      if (!this.application.$models.mongoose[this.entity]) {
        return {
          error: `The Entity ${this.entity} has no mapped Mongoose model`,
          data: null,
          status: 500
        }
      } else {
        response = await this._getOneMongo(job)
      }
    } else if (this.storageEngine === 'sequelize') {
      response = await this._getOneSequelize(job)
    } else {
      return {
        error: `The Entity ${this.entity} has no proper set storage engine. It must be sequelize or mongo.`,
        data: null
      }
    }
    return response
  }
}

export default DataAPI
