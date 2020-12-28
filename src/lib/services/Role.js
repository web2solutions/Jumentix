'use strict'

import RabbitEnvelop from '../RabbitEnvelop'
import Service from '../Job/Service' // mandatory
// console.log('xxxxx', RabbitEnvelop)
/**
 * Class representing a Role Entity Service
 * @extends Service
 */
class Role extends Service {
  /**
   * Creates a Role Entity Service
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
    this.entity = 'Role'
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
      return { error: 'Invalid task' }
    }
    /**
        Create a data using builtin CRUD class
    */
    // On Role Create, roles always canDelete = true
    job.payload.canDelete = true
    if (!Array.isArray(job.payload.sub_roles)) {
      job.payload.sub_roles = []
    }
    const sub_roles = [...job.payload.sub_roles]
    const from = job.from
    // console.log(sub_roles, job)
    delete job.payload.sub_roles
    const { error, data, status } = await this.createRecord(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error creating ${this.entity} - ${error}`)
    } else {
      const errors = []
      if (sub_roles.length > 0) {
        // sub_roles.for
        for (let x = 0; x < sub_roles.length; x++) {
          const sub_role = sub_roles[x]
          sub_role.role = data._id
          console.log('sub_role', sub_role)
          // console.log('job', job)
          // console.log('job.from', from)
          // console.log('typeof RabbitEnvelop', typeof RabbitEnvelop)
          job = new RabbitEnvelop({
            from: from,
            entity: 'SubRole',
            action: 'create',
            payload: sub_role
          })
          // console.log(job)
          const response = await this.application.mapperRPC.services.SubRole.create(
            job
          )
          console.log(response)
          if (response.error) {
            console.log(response.error)
            errors.push(response.error)
          }
        }
      }
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
      return { error: 'Invalid task' }
    }
    /**
        Update a data using builtin CRUD class
    */
    // On Role Update, you cant change the name
    if (typeof job.payload.name !== 'undefined') {
      delete job.payload.name
    }
    delete job.payload.sub_roles
    // On Role Update, you cant change the Sub Role name
    // if(typeof job.payload.sub_roles !== 'undefined')
    // {
    //    job.payload.sub_roles.forEach( ( role, index ) => {
    //        delete job.payload.sub_roles[index].name
    //    } )
    // }
    // On Role Update, you cant change the type
    if (typeof job.payload.type !== 'undefined') {
      delete job.payload.type
    }
    // On Role Update, you cant set a role canDelete
    if (typeof job.payload.canDelete !== 'undefined') {
      delete job.payload.canDelete
    }
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
export default Role
