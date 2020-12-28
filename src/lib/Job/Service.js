'use strict'

import Job from './Job'
import axios from 'axios'
import { uploadBase64stringAsFile } from '../util'
import cacheConfig from '../../config/cache'

const env = process.env.NODE_ENV || 'development'

/**
 * Entry interface to handle Jobs
 * @class
 */
class Service extends Job {
  /**
   * Creates generic Entity Service
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor (application) {
    super(application)
    this.application = application

    /**
      Specify the storage engine - memory, mongo or sequelize
      default is mongo
        */
    this.storageEngine = 'mongo' // memory, mongo or sequelize
    /**
      Specify the Entity name which this service handles.
      The entity shall to have a specified Mongoose or Sequelize model
      The Model, The table (collection) and the data entity must ALL have the same name
        */
    this.entity = ''
    /**
      Specify the primary key name which this service handles.
      default is _id
        */
    this.primaryKeyName = '_id'

    /**
      Specify this entity collection data should be cached on redis
      default is false
        */
    this.isCached = cacheConfig[env].isCached
    /**
      Specify this entity collection data should be cached based on user id, entity name and filter.
      If false, caches will be created based on entity name  and filter only.
      default is false
        */
    this.isCachedBasedOnUser = cacheConfig[env].isCachedBasedOnUser

    this.cacheExpiresIn = cacheConfig[env].cacheExpiresIn

    this.uploadBase64stringAsFile = uploadBase64stringAsFile

    this.axios = axios
  }

  setStorageEngine (storageEngine) {
    this.storageEngine = storageEngine // mongo or sequelize
  }

  /**
   * add an sub document to a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async add_sub_document (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Update a data using builtin CRUD class
        */

    const { error, data, status } = await this.addSubDocument(job)
    if (error) {
      /**
        set job as not done
          */
      this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
    } else {
      /**
        set job as done
          */
      this.jobDone(job, data, msg)
    }
    return { error, data, status }
  }

  /**
   * update an sub document to a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async edit_sub_document (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Update a data using builtin CRUD class
        */

    const { error, data, status } = await this.editSubDocument(job)
    if (error) {
      /**
        set job as not done
          */
      this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
    } else {
      /**
        set job as done
          */
      this.jobDone(job, data, msg)
    }
    return { error, data, status }
  }

  /**
   * delete an sub document to a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async delete_sub_document (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Update a data using builtin CRUD class
        */

    const { error, data, status } = await this.deleteSubDocument(job)
    if (error) {
      /**
        set job as not done
          */
      this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
    } else {
      /**
        set job as done
          */
      this.jobDone(job, data, msg)
    }
    return { error, data, status }
  }

  /**
   * add an file to a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async add_file (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Update a data using builtin CRUD class
        */

    if (typeof job.payload.file === 'undefined') {
      /**
          set job as not done
      */
      const error = 'Undefined file payload'
      this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
      return { error, data: false, status: 400 }
    } else if (job.payload.file === '' || job.payload.file === null) {
      /**
          set job as not done
      */
      const error = 'Undefined file payload'
      this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
      return { error, data: false, status: 400 }
    } else {
      job.payload.file.webPath = this.webPath + job.payload.file.name
      const { error, data, status } = await this.addFile(job)
      if (error) {
        /**
              set job as not done
          */
        this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
      } else {
        /**
              set job as done
          */
        this.jobDone(job, data, msg)
      }
      return { error, data, status }
    }
  }

  /**
   * delete an file from anEntity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async delete_file (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Update a data using builtin CRUD class
        */

    if (typeof job.payload.file === 'undefined') {
      /**
          set job as not done
      */
      const error = 'Undefined file payload'
      this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
      return { error, data: false, status: 400 }
    } else if (job.payload.file === '' || job.payload.file === null) {
      /**
          set job as not done
      */
      const error = 'Undefined file payload'
      this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
      return { error, data: false, status: 400 }
    } else {
      job.payload.file.webPath = this.webPath + job.payload.file.name
      const { error, data, status } = await this.addFile(job)
      if (error) {
        /**
              set job as not done
          */
        this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
      } else {
        /**
              set job as done
          */
        this.jobDone(job, data, msg)
      }
      return { error, data, status }
    }
  }

  // =================== >>>>>>>>

  /**
   * create a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async create (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Create a data using builtin CRUD class
        */
    const { error, data, status } = await this.createRecord(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error creating ${this.entity} - ${error}`)
    } else {
      /**
        set job as done
      */
      this.jobDone(job, data, msg)
    }
    // console.info('data', data)
    // console.info('error', error)
    return { error, data, status }
  }

  /**
   * update a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async update (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Update a data using builtin CRUD class
        */
    const { error, data, status } = await this.updateRecord(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error updating ${this.entity} - ${error}`)
    } else {
      /**
          set job as done
      */
      this.jobDone(job, data, msg)
    }
    // console.info('data', data)
    // console.info('error', error)
    return { error, data, status }
  }

  /**
   * delete a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to delete a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async delete (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Delete a data using builtin CRUD class
        */
    const { error, data, status } = await this.deleteRecord(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error deleting ${this.entity} - ${error}`)
    } else {
      /**
          set job as done
      */
      this.jobDone(job, data, msg)
    }
    // console.info('data', data)
    // console.info('error', error)
    return { error, data, status }
  }

  /**
   * Hard delete a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to delete a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async delete_hard (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Delete a data using builtin CRUD class
        */
    const { error, data, status } = await this.deleteHardRecord(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error deleting ${this.entity} - ${error}`)
    } else {
      /**
          set job as done
      */
      this.jobDone(job, data, msg)
    }
    return { error, data, status }
  }

  /**
   * Restore a soft deleted Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to delete a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async restore (job, msg = false) {
    /**
      Validate job payload
      mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }
    /**
      Delete a data using builtin CRUD class
        */
    const { error, data, status } = await this.restoreRecord(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error deleting ${this.entity} - ${error}`)
    } else {
      /**
          set job as done
      */
      this.jobDone(job, data, msg)
    }
    return { error, data, status }
  }

  /**
   * get all Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to get all Records
   * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getAll (job, msg = false) {
    // use inherited Service resources
    /**
      get all records using builtin CRUD class
        */
    const response = await this.getAllRecords(job)
    if (response.error) {
      /**
          set job as not done
      */
      this.jobNotDone(
        job,
        msg,
        `error getting all ${this.entity} records - ${response.error}`
      )
    } else {
      /**
          set job as done
      */
      this.jobDone(job, response.data, msg)
    }
    // console.info('data', data)
    // console.info('error', error)
    return response
  }

  /**
   * get Entity by it Id
   * @function
   * @param {object} job - mandatory - a job object representing the job information to get one Record based on it Id
   * Must contains the _id field
   * job.payload May contains the populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getById (job, msg = false) {
    // use inherited Service resources
    /**
      Get one data based on ID using builtin CRUD class
        */
    const { error, data, status } = await this.getRecordById(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error getting ${this.entity} by Id - ${error}`)
    } else {
      /**
          set job as done
      */
      this.jobDone(job, data, msg)
    }
    // console.info('data', data)
    // console.info('error', error)
    return { error, data, status }
  }

  /**
   * get One Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information get one Record.
   * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getOne (job, msg = false) {
    // use inherited Service resources
    /**
      Get one data based on ID using builtin CRUD class
        */
    const { error, data, status } = await this.getOneRecord(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(
        job,
        msg,
        `error getting one ${this.entity} data - ${error}`
      )
    } else {
      /**
          set job as done
      */
      this.jobDone(job, data, msg)
    }
    // console.info('data', data)
    // console.info('error', error)
    return { error, data, status }
  }

  /**
   * count Entities
   * @function
   * @param {object} job - mandatory - a job object representing the job information get one Record.
   * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async count (job, msg = false) {
    // use inherited Service resources
    /**
      count documents based on filters
        */
    const { error, data, status } = await this.countDocuments(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(
        job,
        msg,
        `error counting documents from ${this.entity} collection - ${error}`
      )
    } else {
      /**
          set job as done
      */
      this.jobDone(job, data, msg)
    }
    // console.info('data', data)
    // console.info('error', error)
    return { error, data, status }
  }

  setJobWherePayload (job, where) {
    // if where was set
    if (job.payload.where) {
      if ('schema' in job.payload.where) {
        // is swagger
        if (typeof job.payload.where.value === 'string') {
          // is swagger
          job.payload.where.value = JSON.parse(job.payload.where.value)
          for (const key in where) {
            job.payload.where.value[key] = where[key]
          }
          job.payload.where.value = JSON.stringify(job.payload.where.value)
        } else {
          // job.payload.where.value = JSON.stringify(where)
          job.payload.where = { schema: true } // emulate API swagger request
          job.payload.where.value = {}
          for (const key in where) {
            job.payload.where.value[key] = where[key]
          }
          job.payload.where.value = JSON.stringify(job.payload.where.value)
        }
      } else { // is worker
        if (typeof job.payload.where === 'string') {
          // is swagger
          job.payload.where = JSON.parse(job.payload.where)
          for (const key in where) {
            job.payload.where[key] = where[key]
          }
          job.payload.where = JSON.stringify(job.payload.where)
        } else {
          for (const key in where) {
            job.payload.where[key] = where[key]
          }
          job.payload.where = JSON.stringify(where)
        }
      }
    } else {
      job.payload.where = { schema: true } // emulate API swagger request
      job.payload.where.value = JSON.stringify(where)
    }
    // console.log('job.payload.where', job.payload.where)

    return job
  }
}

export default Service
