'use strict'

import Service from '../Job/Service' // mandatory

/**
 * Class representing a Human Entity Service
 * @extends Service
 */
class Human extends Service {
  /**
   * Creates a Human Entity Service
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
    this.entity = 'Human'
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

    /**
            Specify this entity collection data should be cached on redis
            default is false
        */
    this.isCached = false
  }

  mountWhereByUserType(job) {
    let where = {}
    // "admin", "staff", "parent", "child", "agency", "caseworker", "manager"

    // console.log('---------------->HUMAN SERVICE')

    let user = job.from
    // console.log('user.roles', user.roles)

    if (
      user.roles.indexOf('caseworker') > -1 &&
      user.roles.indexOf('manager') < 0
    ) {
      // simple caseworker
      where = {
        $or: [
          // { human_relationship: {
          //    $elemMatch : {
          //        'human' : user.human._id // connected simple case worker Human ID
          //    }
          // }},
          { createdBy: user._id }
        ]
      }
    } else if (
      user.roles.indexOf('caseworker') > -1 &&
      user.roles.indexOf('manager') > -1
    ) {
      // caseworker manager
      where['user.roles'] = { $in: ['child', 'parent'] }
    } else if (
      user.roles.indexOf('parent') > -1 ||
      user.roles.indexOf('child') > -1
    ) {
      // clients
      where.createdBy = user._id // connected client User ID
    } else if (user.roles.indexOf('staff') > -1) {
      // staff
      where.createdBy = user._id // connected staff User ID
    }

    job = this.setJobWherePayload(job, where)

    return job
  }

  /**
   * create a Human Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Human Entity
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

    if (typeof job.payload.photo !== 'undefined') {
      if (job.payload.photo === '' || job.payload.photo === null) {
        job.payload.photo = undefined
      } else {
        let fileString = job.payload.photo.toString()
        if (fileString.indexOf('base64') > -1) {
          let { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          console.log(file)
          if (error) {
            job.payload.photo = undefined
          } else {
            job.payload.photo = file
          }
        }
      }
    }

    if (typeof job.payload.signature !== 'undefined') {
      if (job.payload.signature === '' || job.payload.signature === null) {
        job.payload.signature = undefined
      } else {
        let fileString = job.payload.signature.toString()
        if (fileString.indexOf('base64') > -1) {
          let { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          console.log(file)
          if (error) {
            job.payload.signature = undefined
          } else {
            job.payload.signature = file
          }
        }
      }
    }
    // delete job.payload.organization
    if (typeof job.payload.user !== 'undefined') {
      if (job.payload.user === '') {
        delete job.payload.user
      }
      if (job.payload.user === null) {
        delete job.payload.user
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
   * update a Human Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a Human Entity
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
    if (typeof job.payload.photo !== 'undefined') {
      if (job.payload.photo === '' || job.payload.photo === null) {
        job.payload.photo = undefined
      } else {
        let fileString = job.payload.photo.toString()
        if (fileString.indexOf('base64') > -1) {
          let { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          console.log(file)
          if (error) {
            job.payload.photo = undefined
          } else {
            job.payload.photo = file
          }
        }
      }
    }
    if (typeof job.payload.signature !== 'undefined') {
      if (job.payload.signature === '' || job.payload.signature === null) {
        job.payload.signature = undefined
      } else {
        let fileString = job.payload.signature.toString()
        if (fileString.indexOf('base64') > -1) {
          let { error, file } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          console.log(file)
          if (error) {
            job.payload.signature = undefined
          } else {
            job.payload.signature = file
          }
        }
      }
    }
    if (typeof job.payload.user !== 'undefined') {
      if (job.payload.user === '') {
        delete job.payload.user
      }
      if (job.payload.user === null) {
        delete job.payload.user
      }
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

  /**
   * get all Human Entity
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

    job = this.mountWhereByUserType(job)
    let response = await this.getAllRecords(job)
    // { error, data, status, count, pages, limit, page }
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
    // console.info('getAll response', response)
    return response
  }

  /**
   * get Human Entity by it Id
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
    job = this.mountWhereByUserType(job)
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
   * get One Human Entity
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
    job = this.mountWhereByUserType(job)
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

export default Human
