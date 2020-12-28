'use strict'

import querystring from 'querystring'
import Service from '../Job/Service'
import RabbitEnvelop from '../RabbitEnvelop'

/**
 * Class representing a Zoho Service
 * @extends Service
 */
class Zoho extends Service {
  /**
   * Creates a Zoho Service
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor(application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call

    this.entity = 'Zoho'

    this.zoho_token = null

    // console.log(`this.zoho_token ${this.zoho_token}`)
  }

  /**
   * Returns HTTP header to be used on Zoho calls made via axios
   * @function
   * @return {object} { headers }
   */
  getClientHeader(extraHeaders = {}) {
    let self = this
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Zoho-oauthtoken ${self.zoho_token}`
      },
      ...extraHeaders
    }
  }
  /**
   * Do login at Zoho
   * @function
   * @return {object} { error, data, status }
   */
  async login() {
    let self = this,
      error = null,
      query = {
        refresh_token: self.application.config.zoho.refresh_token,
        client_id: self.application.config.zoho.client_id,
        client_secret: self.application.config.zoho.client_secret,
        grant_type: 'refresh_token'
      }
    const { data, status } = await self.axios.post(
      self.application.config.zoho.authURL,
      querystring.stringify(query)
    )

    if (status !== 200) {
      error = data
    } else {
      this.zoho_token = data.access_token
    }
    return { error, data, status }
  }

  /**
   * Do POST request to Zoho API
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
      self.application.config.zoho.apiURL + payload.url,
      payload.body,
      self.getClientHeader()
    )

    if (status !== 200 && status !== 201) {
      /**
                set job as not done
            */
      this.jobNotDone(
        job,
        msg,
        `error doing login at ${this.entity} - ${error}`
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
   * Do GET request to Zoho API
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
      self.application.config.zoho.apiURL + payload.url,
      self.getClientHeader()
    )

    if (status !== 200) {
      /**
                set job as not done
            */
      this.jobNotDone(
        job,
        msg,
        `error doing login at ${this.entity} - ${error}`
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
   * Create account on Zoho by calling /Accounts end point
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
    const uri = self.application.config.zoho.apiURL + `Accounts`

    if (this.zoho_token === null) {
      await self.login({
        from: job.from,
        entity: 'Zoho',
        action: 'login'
      })
    }

    try {
      // https://www.npmjs.com/package/axios#response-schema
      let response = await self.axios.post(
        uri,
        { data: [job.payload.data] },
        self.getClientHeader()
      )
      // console.log(response.data.data[0])
      data = response.data.data[0]
      status = response.status

      let job2 = new RabbitEnvelop({
        from: job.from,
        entity: 'Account',
        action: 'update',
        payload: { data, account_id: job.payload.account_id }
      })
      let target_queue = `${self.application.config.app.productPrefix}.Account.update.${self.application.config.app.companyCode}`
      let message_response = self.application.sender.send.messageToQueue(
        target_queue,
        job2
      )
      if (message_response.error || message_response.status !== 200) {
        this.jobNotDone(
          job2,
          msg,
          `error sending message to ${target_queue} - ${error}`
        )
      } else {
        this.jobDone(job, data, msg)
      }
    } catch (e) {
      // console.log(e.response)
      error = e
      data = e.response.data
      status = e.response.status
      this.jobNotDone(
        job,
        msg,
        `error creating account at ${this.entity} - ${error}`
      )
    }
    // console.log({ error, data, status })
    return { error, data, status }
  }

  /**
   * Create contact on Zoho by calling /Accounts end point
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
    const uri = self.application.config.zoho.apiURL + `Contacts`

    if (this.zoho_token === null) {
      await self.login({
        from: job.from,
        entity: 'Zoho',
        action: 'login'
      })
    }

    try {
      // https://www.npmjs.com/package/axios#response-schema
      let response = await self.axios.post(
        uri,
        { data: [job.payload.data] },
        self.getClientHeader()
      )
      data = response.data.data[0]
      status = response.status

      let job2 = new RabbitEnvelop({
        from: job.from,
        entity: 'Account',
        action: 'update',
        payload: { data, account_id: job.payload.account_id }
      })
      let target_queue = `${self.application.config.app.productPrefix}.Account.update.${self.application.config.app.companyCode}`
      let message_response = self.application.sender.send.messageToQueue(
        target_queue,
        job2
      )
      if (message_response.error || message_response.status !== 200) {
        this.jobNotDone(
          job2,
          msg,
          `error sending message to ${target_queue} - ${error}`
        )
      } else {
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
   * Update contact on Zoho by calling /Accounts end point
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
    const uri =
      self.application.config.zoho.apiURL + `Contacts/` + job.payload.contact_id

    if (this.zoho_token === null) {
      await self.login({
        from: job.from,
        entity: 'Zoho',
        action: 'login'
      })
    }

    try {
      // https://www.npmjs.com/package/axios#response-schema
      let response = await self.axios.post(
        uri,
        { data: [job.payload.data] },
        self.getClientHeader()
      )
      data = response.data.data[0]
      status = response.status
      this.jobDone(job, data, msg)
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
}

export default Zoho
