'use strict'

import Service from '../Job/Service' // mandatory

/**
 * Class representing a SocketChannel Entity Service
 * @extends Service
 */
class SocketChannel extends Service {
  /**
   * Creates a SocketChannel Entity Service
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
    this.entity = 'SocketChannel'
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

  mountWhereByUserType(job) {
    let where = {}
    // "admin", "staff", "parent", "child", "agency", "caseworker", "manager"

    // console.log('----------------> SERVICE')

    let user = job.from
    // console.log('user.roles', user.roles)

    // simple caseworker
    where = {
      $or: [
        {
          $and: [
            {
              type: 'personal'
            },
            {
              owner: user._id
            }
          ]
        },
        {
          $and: [
            {
              type: 'talk'
            },
            {
              // people: { $in: [ user._id ] }
              people: {
                $elemMatch: {
                  userId: user._id
                }
              }
            }
          ]
        }
      ]
    }

    job = this.setJobWherePayload(job, where)

    return job
  }

  /**
   * get all  Entity
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
}

export default SocketChannel
