'use strict'

import Service from '../Job/Service' // mandatory

/**
 * Class representing a Consumidor Entity Service
 * @extends Service
 */
class Consumidor extends Service {
  /**
   * Creates a Consumidor Entity Service
   * @constructor
   * @param {object} application - mandatory - the application object which this service is plugged to
   */
  constructor (application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call
    /**
            Specify the Entity name which this service handles.
            The entity shall to have a specified Mongoose or Sequelize model
            The Model, The table (collection) and the data entity must ALL have the same name
        */
    this.entity = 'Consumidor'
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
   * create a Human Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Human Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async create (job, msg) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: 'Invalid task' }
    }

    /* if (typeof job.payload.avatar !== 'undefined') {
      if (job.payload.avatar === '' || job.payload.avatar === null) {
        job.payload.avatar = undefined
      } else {
        const fileString = job.payload.avatar.toString()
        if (fileString.indexOf('base64') > -1) {
          const { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          console.log(file)
          if (error) {
            job.payload.avatar = undefined
          } else {
            job.payload.avatar = file
          }
        }
      }
    }

    if (typeof job.payload.documento !== 'undefined') {
      if (job.payload.documento === '' || job.payload.documento === null) {
        job.payload.documento = undefined
      } else {
        const fileString = job.payload.documento.toString()
        if (fileString.indexOf('base64') > -1) {
          const { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          console.log(file)
          if (error) {
            job.payload.documento = undefined
          } else {
            job.payload.documento = file
          }
        }
      }
    } */
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
   * update a Human Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Human Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async update (job, msg) {
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
    /* if (typeof job.payload.avatar !== 'undefined') {
      if (job.payload.avatar === '' || job.payload.avatar === null) {
        job.payload.avatar = undefined
      } else {
        const fileString = job.payload.avatar.toString()
        if (fileString.indexOf('base64') > -1) {
          const { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          console.log(file)
          if (error) {
            job.payload.avatar = undefined
          } else {
            job.payload.avatar = file
          }
        }
      }
    }
    if (typeof job.payload.documento !== 'undefined') {
      if (job.payload.documento === '' || job.payload.documento === null) {
        job.payload.documento = undefined
      } else {
        const fileString = job.payload.documento.toString()
        if (fileString.indexOf('base64') > -1) {
          const { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          console.log(file)
          if (error) {
            job.payload.documento = undefined
          } else {
            job.payload.documento = file
          }
        }
      }
    } */
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
}

export default Consumidor
