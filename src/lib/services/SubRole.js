'use strict'

import Service from '../Job/Service' // mandatory

/**
 * Class representing a SubRole Entity Service
 * @extends Service
 */
class SubRole extends Service {
  /**
   * Creates a SubRole Entity Service
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
    this.entity = 'SubRole'
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
   * create a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
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

    // On SubRole Create, roles always canDelete = true
    // job.payload.canDelete = true
    console.log('SUBROLE', job.payload)
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
   * update a Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Entity
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
    // On SubRole Update, you cant change the name
    if (typeof job.payload.name !== 'undefined') {
      delete job.payload.name
    }

    delete job.payload.role

    // On SubRole Update, you cant set a role canDelete
    if (typeof job.payload.canDelete !== 'undefined') {
      delete job.payload.canDelete
    }

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
}

export default SubRole
