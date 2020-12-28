'use strict'

import moment from 'moment-timezone'
import Service from '../Job/Service'

/**
 * Class representing a Wordpress Service
 * @extends Service
 */
class Wordpress extends Service {
  /**
   * Creates a Wordpress Service
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor(application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call

    this.entity = 'Wordpress'

    this.wordpress_token = null

    this.token_expiry = null
  }

  /**
   * Returns HTTP header to be used on Wordpress calls made via axios
   * @function
   * @return {object} { headers }
   */
  getClientHeader(extraHeaders = {}) {
    let self = this
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${self.wordpress_token}`
      },
      ...extraHeaders
    }
  }

  /**
   * Validate whether the token exist and not expired
   * @function
   * @return Boolean
   */
  validateToken() {
    return (
      this.wordpress_token !== null && new Date().valueOf() < this.token_expiry
    )
  }

  /**
   * Do login at Wordpress
   * @function
   * @return {object} { error, data, status }
   */
  async login() {
    let self = this,
      error = null,
      payload = {
        username: self.application.config.wordpress.clientId,
        password: self.application.config.wordpress.clientSecret
      }
    const { data, status } = await self.axios.post(
      self.application.config.wordpress.authURL,
      payload
    )

    if (status !== 200) {
      error = data
    } else {
      this.wordpress_token = data.token
      let tokenExpireDays =
        self.application.config.wordpress.tokenExpireDays || 1
      this.token_expiry = moment().add(tokenExpireDays, 'days').valueOf()
    }
    return { error, data, status }
  }

  /**
   * Do POST request to Wordpress API
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async post(job, msg = false) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }

    let self = this,
      payload = job.payload, // payload is the resource information associated to this task data
      error = null
    const { data, status } = await self.axios.post(
      self.application.config.wordpress.apiURL + payload.url,
      payload.body,
      self.getClientHeader()
    )

    if (status !== 200 && status !== 201) {
      /**
                set job as not done
            */
      this.jobNotDone(job, msg, `error doing post at ${this.entity} - ${error}`)
      error = data
    } else {
      /**
                set job as done
            */
      this.jobDone(job, data, msg)
    }
    return { error, data, status }
  }

  /**
   * Do GET request to Wordpress API
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async get(job, msg = false) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }

    let self = this,
      payload = job.payload, // payload is the resource information associated to this task data
      error = null
    const { data, status } = await self.axios.get(
      self.application.config.wordpress.apiURL + payload.url,
      self.getClientHeader()
    )

    if (status !== 200) {
      /**
                set job as not done
            */
      this.jobNotDone(job, msg, `error doing get at ${this.entity} - ${error}`)
      error = data
    } else {
      /**
                set job as done
            */
      this.jobDone(job, data, msg)
    }
    return { error, data, status }
  }

  /**
   * Do DELETE request to Wordpress API
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async delete(job, msg = false) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }

    let self = this,
      payload = job.payload, // payload is the resource information associated to this task data
      error = null
    const { data, status } = await self.axios.delete(
      self.application.config.wordpress.apiURL + payload.url,
      self.getClientHeader()
    )

    if (status !== 200) {
      /**
                set job as not done
            */
      this.jobNotDone(
        job,
        msg,
        `error doing delete at ${this.entity} - ${error}`
      )
      error = data
    } else {
      /**
                set job as done
            */
      this.jobDone(job, data, msg)
    }
    return { error, data, status }
  }

  /**
   * Create/Update post on Wordpress by calling /pf/v1/posts end point
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async postCreate(job, msg = false) {
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
    const uri = self.application.config.wordpress.apiURL + `pf/v1/posts`

    if (!self.validateToken()) {
      await self.login({
        from: job.from,
        entity: 'Wordpress',
        action: 'login'
      })
    }

    try {
      // https://www.npmjs.com/package/axios#response-schema
      let response = await self.axios.post(
        uri,
        job.payload,
        self.getClientHeader()
      )
      data = response.data.data
      status = response.data.data.status
      this.jobDone(job, data, msg)
    } catch (e) {
      error = e.response.data.message
      data = e.response.data.data
      status = e.response.data.data.status
      this.jobNotDone(
        job,
        msg,
        `error creating Post at ${this.entity} - ${error}`
      )
    }
    console.log({ error, data, status })
    return { error, data, status }
  }

  /**
   * Delete a post from Wordpress by calling pf/v1/posts/{mapping_id}/{type} end point
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async postDelete(job, msg = false) {
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
    const uri =
      self.application.config.wordpress.apiURL +
      `pf/v1/posts/` +
      job.payload.mapping_id +
      `/` +
      job.payload.post_type

    if (!self.validateToken()) {
      await self.login({
        from: job.from,
        entity: 'Wordpress',
        action: 'login'
      })
    }

    try {
      // https://www.npmjs.com/package/axios#response-schema
      let response = await self.axios.delete(uri, self.getClientHeader())
      data = response.data
      status = response.status
      this.jobDone(job, data, msg)
    } catch (e) {
      error = e.response.data.message
      data = e.response.data.data
      status = e.response.data.data.status
      this.jobNotDone(
        job,
        msg,
        `error deleting Post at ${this.entity} - ${error}`
      )
    }
    console.log({ error, data, status })
    return { error, data, status }
  }

  /**
   * Update user on Wordpress by calling /pf/v1/user/updateUserDetails end point
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async userUpdate(job, msg = false) {
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
    const uri =
      self.application.config.wordpress.apiURL + `pf/v1/user/updateUserDetails`

    if (!self.validateToken()) {
      await self.login({
        from: job.from,
        entity: 'Wordpress',
        action: 'login'
      })
    }

    try {
      // https://www.npmjs.com/package/axios#response-schema
      let response = await self.axios.post(
        uri,
        job.payload,
        self.getClientHeader()
      )
      data = response.data
      status = response.status
      this.jobDone(job, data, msg)
    } catch (e) {
      error = e.response.data.message
      data = e.response.data.data
      status = e.response.data.data.status
      this.jobNotDone(
        job,
        msg,
        `error updating User at ${this.entity} - ${error}`
      )
    }
    console.log({ error, data, status })
    return { error, data, status }
  }
}

export default Wordpress
