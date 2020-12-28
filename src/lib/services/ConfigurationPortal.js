'use strict'

import Service from '../Job/Service' // mandatory

/**
 * Class representing a ConfigurationPortal Entity Service
 * @extends Service
 */
class ConfigurationPortal extends Service {
  /**
   * Creates a ConfigurationPortal Entity Service
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
    this.entity = 'ConfigurationPortal'
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
   * create a ConfigurationPortal Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a ConfigurationPortal Entity
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
    // console.log('job.payload', job.payload);
    if (typeof job.payload.logo !== 'undefined') {
      if (job.payload.logo === '' || job.payload.logo === null) {
        job.payload.logo = undefined
      } else {
        let fileString = job.payload.logo.toString()
        if (fileString.indexOf('base64') > -1) {
          let { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          // console.log( file )
          if (error) {
            job.payload.logo = undefined
          } else {
            job.payload.logo = file
          }
        }
      }
    }

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
   * update a ConfigurationPortal Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a ConfigurationPortal Entity
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
    if (typeof job.payload.logo !== 'undefined') {
      if (job.payload.logo === '' || job.payload.logo === null) {
        job.payload.logo = undefined
      } else {
        let fileString = job.payload.logo.toString()
        if (fileString.indexOf('base64') > -1) {
          let { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          // console.log(error)
          // console.log( file )
          if (error) {
            job.payload.logo = undefined
          } else {
            job.payload.logo = file
          }
        }
      }
    }

    // console.log(`ConfigurationPortal service job ${job.payload.password}`)
    // console.log('job.payload', job.payload.password);
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

export default ConfigurationPortal
