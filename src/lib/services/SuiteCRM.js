'use strict'

import querystring from 'querystring'
import Service from '../Job/Service'

/**
 * Class representing a SuiteCRM Service
 * @extends Service
 */
class SuiteCRM extends Service {
  /**
   * Creates a SuiteCRM Service
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor(application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call

    this.entity = 'SuiteCRM'
  }

  /**
   * Create account on SuiteCRM
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async accountCreate(job, msg = false) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }

    let self = this,
      error = null,
      data = null,
      status = null
    const uri = self.application.config.suitecrm.apiURL + `account_api.php`,
      payload = job.payload
    payload.access_token = self.application.config.suitecrm.accessToken
    console.log(payload)
    try {
      let response = await self.axios.post(uri, querystring.stringify(payload))
      data = response.data.message
      if (response.data.id === null) {
        status = 400
        error = response.data.message
        if (response.data.message === 'Invalid Access Token') {
          status = 401
        }
        this.jobNotDone(
          job,
          msg,
          `error creating account at ${this.entity} - ${response.data.message}`
        )
      } else {
        status = 201
        this.jobDone(job, data, msg)
      }
    } catch (e) {
      status = 400
      error = e
      data = e.response.data
      status = e.response.status
      this.jobNotDone(
        job,
        msg,
        `error creating account at ${this.entity} - ${error}`
      )
    }
    console.log({ error, data, status })
    return { error, data, status }
  }

  /**
   * Create contact on SuiteCRM
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async contactCreate(job, msg = false) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }

    let self = this,
      error = null,
      data = null,
      status = null
    const uri = self.application.config.suitecrm.apiURL + `contact_api.php`,
      payload = job.payload
    payload.access_token = self.application.config.suitecrm.accessToken

    try {
      let response = await self.axios.post(uri, querystring.stringify(payload))
      data = response.data.message
      if (response.data.id === null) {
        status = 400
        error = response.data.message
        if (response.data.message === 'Invalid Access Token') {
          status = 401
        }
        this.jobNotDone(
          job,
          msg,
          `error creating account at ${this.entity} - ${response.data.message}`
        )
      } else {
        status = 201
        this.jobDone(job, data, msg)
      }
    } catch (e) {
      error = e
      data = e.response.data
      status = e.response.status
      this.jobNotDone(
        job,
        msg,
        `error creating contact at ${this.entity} - ${error}`
      )
    }
    console.log({ error, data, status })
    return { error, data, status }
  }

  /**
   * update account on SuiteCRM
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async accountUpdate(job, msg = false) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }

    let self = this,
      error = null,
      data = null,
      status = null
    const uri = self.application.config.suitecrm.apiURL + `account_api.php`,
      payload = job.payload
    payload.access_token = self.application.config.suitecrm.accessToken

    try {
      let response = await self.axios.post(uri, querystring.stringify(payload))
      data = response.data.message
      if (response.data.id === null) {
        status = 400
        error = response.data.message
        if (response.data.message === 'Invalid Access Token') {
          status = 401
        }
        this.jobNotDone(
          job,
          msg,
          `error creating account at ${this.entity} - ${response.data.message}`
        )
      } else {
        status = 200
        this.jobDone(job, data, msg)
      }
    } catch (e) {
      error = e
      data = e.response.data
      status = e.response.status
      this.jobNotDone(
        job,
        msg,
        `error creating account at ${this.entity} - ${error}`
      )
    }
    console.log({ error, data, status })
    return { error, data, status }
  }

  /**
   * Update contact on SuiteCRM
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async contactUpdate(job, msg = false) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }

    let self = this,
      error = null,
      data = null,
      status = null
    const uri = self.application.config.suitecrm.apiURL + `contact_api.php`,
      payload = job.payload
    payload.access_token = self.application.config.suitecrm.accessToken

    try {
      let response = await self.axios.post(uri, querystring.stringify(payload))
      data = response.data.message
      if (response.data.id === null) {
        status = 400
        error = response.data.message
        if (response.data.message === 'Invalid Access Token') {
          status = 401
        }
        this.jobNotDone(
          job,
          msg,
          `error creating account at ${this.entity} - ${response.data.message}`
        )
      } else {
        status = 200
        this.jobDone(job, data, msg)
      }
    } catch (e) {
      error = e
      data = e.response.data
      status = e.response.status
      this.jobNotDone(
        job,
        msg,
        `error creating contact at ${this.entity} - ${error}`
      )
    }
    console.log({ error, data, status })
    return { error, data, status }
  }
}

export default SuiteCRM
