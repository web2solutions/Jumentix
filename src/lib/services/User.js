'use strict'

import Service from '../Job/Service' // mandatory
import RabbitEnvelop from '../RabbitEnvelop'
import {
  User as UserModel
} from '../models/mongoose/User'
import {
  calcUsername,
  gen6Digs,
  randomPassword
} from '../util'
import {
  sha512
} from 'js-sha512'

/**
 * Class representing a User Entity Service
 * @extends Service
 */
class User extends Service {
  /**
   * Creates a User Entity Service
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
    this.entity = 'User'
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
            set IO directory name where files from this entity will be uploaded to
        */
    // this.entityDir = this.application.cdnDIR + this.entity + '/'

    /**
            Specify this entity collection data should be cached on redis
            default is false
        */
    this.isCached = false
  }

  mountCreateUserJob (job) {
    const createUserJob = {
      ...job
    }
    createUserJob.payload = {
      username: job.payload.email,
      password: randomPassword(),
      active: false,
      portal_access: true,
      roles: ['parent'],
      provider: 'local',
      changePasswordNextLogin: true
    }
    createUserJob.entity = 'User'
    createUserJob.action = 'create'
    return new RabbitEnvelop({
      ...createUserJob,
      from: this.application.getServerUser()
    })
  }

  mountDeleteUserJob (job, id) {
    const deleteUserJob = {
      ...job
    }
    deleteUserJob.payload = {
      [this.primaryKeyName]: id

    }
    deleteUserJob.entity = 'User'
    deleteUserJob.action = 'delete_hard'
    return new RabbitEnvelop({
      ...deleteUserJob,
      from: this.application.getServerUser()
    })
  }

  mountDeleteHumanJob (job, id) {
    const deleteUserJob = {
      ...job
    }
    deleteUserJob.payload = {
      [this.primaryKeyName]: id

    }
    deleteUserJob.entity = 'Human'
    deleteUserJob.action = 'delete_hard'
    return new RabbitEnvelop({
      ...deleteUserJob,
      from: this.application.getServerUser()
    })
  }

  mountUpdateUserJob (job, user, human) {
    const updateUserJob = {
      ...job
    }
    updateUserJob.payload = {
      _id: user._id.toString(),
      human: human._id.toString()
    }
    updateUserJob.entity = 'User'
    updateUserJob.action = 'update'
    return new RabbitEnvelop({
      ...updateUserJob,
      from: this.application.getServerUser()
    })
  }

  mountCreateHumanJob (job, user) {
    const createHumanJob = {
      ...job
    }
    const pArray = job.payload.phone.split('-')
    const phoneCountry = pArray[0]
    const phoneArea = pArray[1]
    const phoneNumber = `${pArray[2]}-${pArray[3]}`

    createHumanJob.payload = {
      user: user._id.toString(),
      first_name: job.payload.first_name,
      last_name: job.payload.last_name,
      phone: [{
        type: 'Home',
        country_code: phoneCountry,
        area_number: phoneArea,
        number: phoneNumber,
        isDefault: true
      }],
      email: [{
        type: 'Home',
        email: job.payload.email,
        isDefault: true
      }]
    }
    createHumanJob.entity = 'Human'
    createHumanJob.action = 'create'
    return new RabbitEnvelop({
      ...createHumanJob,
      from: this.application.getServerUser()
    })
  }

  mountSendGmailJob (job, data) {
    const sendGmailJob = {
      ...job
    }

    sendGmailJob.payload = {
      to: 'web2solucoes@gmail.com', // email list separated by comma
      subject: 'Please activate your account',
      message: `
        Activation code:</br></br>
        ${data.user.activationCode}
      `
    }
    sendGmailJob.entity = 'Gmail'
    sendGmailJob.action = 'send'
    return new RabbitEnvelop({
      ...sendGmailJob,
      from: this.application.getServerUser()
    })
  }

  mountSendTwilioJob (job, data) {
    const sendSMSJob = {
      ...job
    }

    sendSMSJob.payload = {
      to: '+5527997375850', // +17737508284
      from: this.application.config.twilio.PHONE_NUMBER,
      body: `
        Please activate your account to use this CAIRS Solutions product \n
        Activation code: \n\n 
        ${data.activationCode}
      `
    }
    sendSMSJob.entity = 'Twilio'
    sendSMSJob.action = 'send'
    return new RabbitEnvelop({
      ...sendSMSJob,
      from: this.application.getServerUser()
    })
  }

  /**
   * Register User and Human
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a User Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async register (job, msg) {
    let eMessage = false
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return {
        error: 'Invalid task'
      }
    }

    if (!job.payload.email) {
      eMessage = 'error registering account - email is missing'
    }

    if (!job.payload.first_name) {
      eMessage = 'error registering account - first name is missing'
    }

    if (!job.payload.last_name) {
      eMessage = 'error registering account - last name is missing'
    }

    if (!job.payload.phone) {
      eMessage = 'error registering account - phone is missing'
    }

    job.payload.notifyBy = job.payload.notifyBy === 'sms' ? 'sms' : 'email'

    if (eMessage) {
      // this.jobNotDone(job, msg, eMessage)
      return {
        error: eMessage,
        data: null,
        status: 500
      }
    }

    /*
      paylod = {
        email: '',
        first_name: '',
        last_name: '',
        phone: '', // +1-444-222-3333,
        bestTimeToCall: '',
        notifyBy: 'sms' // sms, email
      }
    */
    // create User
    const createUserResponse = await this.create(
      this.mountCreateUserJob(job)
    )
    if (createUserResponse.error) {
      this.jobNotDone(job, msg, `error creating User - ${createUserResponse.error}`)
      return {
        error: createUserResponse.error,
        data: createUserResponse.data,
        status: 500
      }
    }

    // create Human
    const createHumanResponse = await this.application.mapperRPC.services.Human.create(
      this.mountCreateHumanJob(job, createUserResponse.data)
    )
    if (createHumanResponse.error) {
      // DELETE createUserResponse.data._id
      await this.delete_hard(this.mountDeleteUserJob(job, createUserResponse.data._id.toString()))
      this.jobNotDone(job, msg, `error creating Human - ${createHumanResponse.error}`)
      return {
        error: createHumanResponse.error,
        data: createHumanResponse.data,
        status: 500
      }
    }

    // update user
    const updateUserResponse = await this.update(
      this.mountUpdateUserJob(job, createUserResponse.data, createHumanResponse.data)
    )
    if (updateUserResponse.error) {
      this.jobNotDone(job, msg, `error updating User - ${updateUserResponse.error}`)
      return {
        error: updateUserResponse.error,
        data: updateUserResponse.data,
        status: 500
      }
    }

    /* const sendGmailResponse = await this.application.mapperRPC.services.Gmail.send(
      this.mountSendGmailJob(job, {
        user: updateUserResponse.data,
        human: createHumanResponse.data
      })
    )
    console.log(sendGmailResponse)

    const sendTwilioResponse = await this.application.mapperRPC.services.Twilio.send(
      this.mountSendTwilioJob(job, updateUserResponse.data)
    )
    console.log(sendTwilioResponse) */

    const data = {
      user: updateUserResponse.data,
      human: createHumanResponse.data
    }
    this.jobDone(job, data, msg)

    return {
      error: null,
      data,
      status: 201
    }
  }

  /**
   * create a User Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a User Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async create (job, msg) {
    let eMessage = false
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return {
        error: 'Invalid task'
      }
    }
    if (!job.payload.username) {
      eMessage = 'error creating User - username is missing'
    }

    if (typeof job.payload.password !== 'undefined') {
      if (job.payload.password === '') {
        delete job.payload.password
      }
      if (job.payload.password === null) {
        delete job.payload.password
      }
      if (typeof job.payload.password !== 'string') {
        delete job.payload.password
      }
    }
    if (!job.payload.password) {
      eMessage = 'error creating User - password is missing'
    }

    if (eMessage) {
      return {
        error: eMessage
      }
    }
    /**
            Create a data using builtin CRUD class
        */
    if (typeof job.payload.avatar !== 'undefined') {
      if (job.payload.avatar === '' || job.payload.avatar === null) {
        job.payload.avatar = undefined
      } else {
        const fileString = job.payload.avatar.toString()
        if (fileString.indexOf('base64') > -1) {
          const {
            error,
            file
          } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          console.log(error)
          // console.log( file )
          if (error) {
            job.payload.avatar = undefined
          } else {
            job.payload.avatar = file
          }
        }
      }
    }

    // user.human must be a valid ObjectID
    if (typeof job.payload.human !== 'undefined') {
      if (job.payload.human === '') {
        delete job.payload.human
      }
      if (job.payload.human === null) {
        delete job.payload.human
      }
      if (typeof job.payload.human !== 'string') {
        delete job.payload.human
      }
    }

    if (typeof job.payload.human === 'undefined') {
      delete job.payload.human
    }
    // console.log(`User service ${job.payload.password}`)
    if (job.payload.password) {
      const hash = sha512.hex(job.payload.password)
      job.payload.password = hash
      job.payload.last_password_change = new Date(Date.now()).toString()
    }

    if (!job.payload.roles) {
      job.payload.roles = ['parent']
    }

    if (job.payload.provider !== 'local') {
      const username = await calcUsername(UserModel, job.payload.username)
      job.payload.username = username // set new username
    }

    job.payload.activationCode = gen6Digs()
    job.payload.resetCode = gen6Digs()

    job.payload.notifyBy = job.payload.notifyBy === 'sms' ? 'sms' : 'email'

    const {
      error,
      data,
      status
    } = await this.createRecord(job)
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
    return {
      error,
      data,
      status
    }
  }

  /**
   * update a User Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a User Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async update (job, msg) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return {
        error: 'Invalid task'
      }
    }
    /**
            Update a data using builtin CRUD class
        */
    if (typeof job.payload.avatar !== 'undefined') {
      if (job.payload.avatar === '' || job.payload.avatar === null) {
        job.payload.avatar = undefined
      } else {
        const fileString = job.payload.avatar.toString()
        if (fileString.indexOf('base64') > -1) {
          const {
            error,
            file
          } = await this.uploadBase64stringAsFile(
            fileString,
            job,
            this.entityDir,
            this.webPath
          )
          // console.log(error)
          // console.log( file )
          if (error) {
            job.payload.avatar = undefined
          } else {
            job.payload.avatar = file
          }
        }
      }
    }

    // user.human must be a valid ObjectID
    if (typeof job.payload.human !== 'undefined') {
      if (job.payload.human === '') {
        delete job.payload.human
      }
      if (job.payload.human === null) {
        delete job.payload.human
      }
      if (typeof job.payload.human !== 'string') {
        delete job.payload.human
      }
    }

    if (typeof job.payload.human === 'undefined') {
      delete job.payload.human
    }

    // console.log(`User service ${job.payload.password}`)
    if (typeof job.payload.password !== 'undefined') {
      if (job.payload.password === '') {
        delete job.payload.password
      }
      if (job.payload.password === null) {
        delete job.payload.password
      }
      if (typeof job.payload.password !== 'string') {
        delete job.payload.password
      }
    }

    if (job.payload.password) {
      const hash = sha512.hex(job.payload.password)
      job.payload.password = hash
      job.payload.last_password_change = new Date(Date.now()).toString()
    }

    delete job.payload.activationCode

    const {
      error,
      data,
      status
    } = await this.updateRecord(job)
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
    return {
      error,
      data,
      status
    }
  }
}

export default User
