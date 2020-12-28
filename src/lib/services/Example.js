'use strict'

import Service from '../Job/Service' // mandatory

/**
 * Class representing a Example Entity Service
 * @extends Service
 */
class Example extends Service {
  /**
   * Creates a Example Entity Service
   * @constructor
   * @param {object} application - mandatory - the application object which this service is plugged to
   */
  constructor(application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call
    /**
            Specify the Entity name which this service handles.
            The entity shall to have a specified Mongoose or Sequelize model
            The Model, The table (collection) and the data entity must ALL have the same name
        */
    this.entity = 'Example'
    /**
            Specify the primary key name which this service handles.
            default is _id
        */
    this.primaryKeyName = '_id'
    /**
            Specify the storage engine - memory, mongo or sequelize
            default is mongo
        */
    this.setStorageEngine('mongo') // default is mongo
  }

  /**
   * create a Example Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Example Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async create(job, msg) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }
    /**
            Create a data using builtin CRUD class
        */
    let { error, data, status } = await this.createRecord(job)
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
   * update a Example Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Example Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async update(job, msg) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }
    /**
            Update a data using builtin CRUD class
        */
    let { error, data, status } = await this.updateRecord(job)
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
   * delete a Example Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to delete a Example Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async delete(job, msg) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }
    /**
            Delete a data using builtin CRUD class
        */
    let { error, data, status } = await this.deleteRecord(job)
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
   * Hard delete a Example Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to delete a Example Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async delete_hard(job, msg) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }
    /**
            Delete a data using builtin CRUD class
        */
    let { error, data, status } = await this.deleteHardRecord(job)
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
   * Restore a soft deleted Example Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to delete a Example Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async restore(job, msg) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }
    /**
            Delete a data using builtin CRUD class
        */
    let { error, data, status } = await this.restoreRecord(job)
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
   * get all Example Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to get all Records
   * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getAll(job, msg) {
    // use inherited Service resources
    /**
            get all records using builtin CRUD class
        */
    let {
      error,
      data,
      status,
      count,
      pages,
      limit,
      page
    } = await this.getAllRecords(job)
    if (error) {
      /**
                set job as not done
            */
      this.jobNotDone(
        job,
        msg,
        `error getting all ${this.entity} records - ${error}`
      )
    } else {
      /**
                set job as done
            */
      this.jobDone(job, data, msg)
    }
    // console.info('data', data)
    // console.info('error', error)
    return { error, data, status, count, pages, limit, page }
  }

  /**
   * get Example Entity by it Id
   * @function
   * @param {object} job - mandatory - a job object representing the job information to get one Record based on it Id
   * Must contains the _id field
   * job.payload May contains the populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getById(job, msg) {
    // use inherited Service resources
    /**
            Get one data based on ID using builtin CRUD class
        */
    let { error, data, status } = await this.getRecordById(job)
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
   * get One Example Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information get one Record.
   * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getOne(job, msg) {
    // use inherited Service resources
    /**
            Get one data based on ID using builtin CRUD class
        */
    let { error, data, status } = await this.getOneRecord(job)
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
}

export default Example
