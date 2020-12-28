'use strict'

import Service from '../Job/Service' // mandatory
import {
  APIContracts,
  APIControllers
  // ,Constants
} from 'authorizenet'

/**
 * Class representing a AuthorizenetCreditCardPayment Entity Service
 * @extends Service
 */
class AuthorizenetCreditCardPayment extends Service {
  /**
   * Creates a AuthorizenetCreditCardPayment Entity Service
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
    this.entity = 'AuthorizenetCreditCardPayment'
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

  /**
   * charge credit card calling authorizenet
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a AuthorizenetCreditCardPayment Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async charge (job, msg) {
    /**
        Validate job payload
        mandatory run this PRIOR trying to execute any job
    */
    if (!this.isValidJob(job, msg)) {
      return {
        error: 'Invalid task',
        data: null,
        status: 400
      }
    }
    /**
        Create a data using builtin CRUD class
    */
    const self = this

    return new Promise(async function (resolve, reject) {
      let ctrl = null
      try {
        const payload = job.payload
        const productsList = []
        let products = null

        const merchantAuthenticationType = new APIContracts.MerchantAuthenticationType()
        merchantAuthenticationType.setName(self.application.config.authorizenet.apiLoginKey)
        merchantAuthenticationType.setTransactionKey(self.application.config.authorizenet.transactionKey)

        const creditCard = new APIContracts.CreditCardType()
        creditCard.setCardNumber(payload.creditCard.number)
        creditCard.setExpirationDate(payload.creditCard.expiration_date)
        creditCard.setCardCode(payload.creditCard.code)

        console.error('XXXXXXXXXXXXXXXXXXX-------->>>>>', creditCard)

        const paymentType = new APIContracts.PaymentType()
        paymentType.setCreditCard(creditCard)

        const orderDetails = new APIContracts.OrderType()
        orderDetails.setInvoiceNumber(payload.invoice)
        orderDetails.setDescription(payload.description)

        const tax = new APIContracts.ExtendedAmountType()
        tax.setAmount(payload.tax.amount)
        tax.setName(payload.tax.name)
        tax.setDescription(payload.tax.description)

        const duty = new APIContracts.ExtendedAmountType()
        duty.setAmount(payload.duty.amount)
        duty.setName(payload.duty.name)
        duty.setDescription(payload.duty.description)

        const shipping = new APIContracts.ExtendedAmountType()
        shipping.setAmount(payload.shipping.amount)
        shipping.setName(payload.shipping.name)
        shipping.setDescription(payload.shipping.description)

        const billTo = new APIContracts.CustomerAddressType()
        billTo.setFirstName(payload.billTo.first_name)
        billTo.setLastName(payload.billTo.last_name)
        billTo.setCompany(payload.billTo.company)
        billTo.setAddress(payload.billTo.address)
        billTo.setCity(payload.billTo.city)
        billTo.setState(payload.billTo.state)
        billTo.setZip(payload.billTo.zip)
        billTo.setCountry(payload.billTo.country)

        const shipTo = new APIContracts.CustomerAddressType()
        shipTo.setFirstName(payload.shipTo.first_name)
        shipTo.setLastName(payload.shipTo.last_name)
        shipTo.setCompany(payload.shipTo.company)
        shipTo.setAddress(payload.shipTo.address)
        shipTo.setCity(payload.shipTo.city)
        shipTo.setState(payload.shipTo.state)
        shipTo.setZip(payload.shipTo.zip)
        shipTo.setCountry(payload.shipTo.country)

        for (let x = 0; x < payload.products.length; x++) {
          const p = payload.products[x]
          const product = new APIContracts.LineItemType()

          product.setItemId(p.id)
          product.setName(p.name)
          product.setDescription(p.description)
          product.setQuantity(p.quantity)
          product.setUnitPrice(p.unit_price)

          productsList.push(product)
        }

        if (productsList.length > 0) {
          products = new APIContracts.ArrayOfLineItem()
          products.setLineItem(productsList)
        }

        const conf1 = new APIContracts.SettingType()
        conf1.setSettingName('recurringBilling')
        conf1.setSettingValue(payload.recurringBilling)

        const transactionSettings = new APIContracts.ArrayOfSetting()
        transactionSettings.setSetting([conf1])

        const transactionRequestType = new APIContracts.TransactionRequestType()
        transactionRequestType.setTransactionType(APIContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION)
        transactionRequestType.setPayment(paymentType)
        transactionRequestType.setAmount(payload.amount)
        transactionRequestType.setLineItems(products)
        transactionRequestType.setOrder(orderDetails)
        transactionRequestType.setTax(tax)
        transactionRequestType.setDuty(duty)
        transactionRequestType.setShipping(shipping)
        transactionRequestType.setBillTo(billTo)
        transactionRequestType.setShipTo(shipTo)
        transactionRequestType.setTransactionSettings(transactionSettings)

        const createRequest = new APIContracts.CreateTransactionRequest()
        createRequest.setMerchantAuthentication(merchantAuthenticationType)
        createRequest.setTransactionRequest(transactionRequestType)

        ctrl = new APIControllers.CreateTransactionController(createRequest.getJSON())
      } catch (e) {
        // statements
        // console.log(e);
        return resolve({
          error: e,
          data: null,
          status: 500
        })
      }

      ctrl.execute(() => {
        let response = null
        let error = null
        let status = 500
        try {
          response = new APIContracts.CreateTransactionResponse(ctrl.getResponse())
          if (response !== null) {
            if (response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
              if (response.getTransactionResponse().getMessages() !== null) { status = 201 }
            }
          }
        } catch (e) {
          error = e
        }
        return resolve({
          error: error,
          data: response,
          status: status
        })
      })
    })
  }

  /**
   * create a AuthorizenetCreditCardPayment Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a AuthorizenetCreditCardPayment Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async create (job, msg) {
    /**
        Validate job payload
        mandatory run this PRIOR trying to execute any job
    */
    if (!this.isValidJob(job, msg)) {
      return {
        error: 'Invalid task',
        data: null,
        status: 400
      }
    }

    delete job.payload.transactionId
    delete job.payload.status
    delete job.payload.response

    /**
        Create a data using builtin CRUD class
    */
    const responseCharge = await this.charge(job, msg)
    console.error(responseCharge)
    if (responseCharge.error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error charging through credit card on Authorize.net - ${responseCharge.error}`)
      return {
        error: responseCharge.error,
        data: null,
        status: 402
      }
    }

    if (responseCharge.status !== 201) {
      const error = responseCharge.data.transactionResponse.errors.error || responseCharge.error
      this.jobNotDone(job, msg, `error charging through credit card on Authorize.net - ${error}`)
      return {
        error,
        data: null,
        status: 402
      }
    }

    job.payload.response = responseCharge.data
    job.payload.status = responseCharge.status
    job.payload.transactionId = responseCharge.data.transactionResponse.transId

    const responseCreateDoc = await this.createRecord(job)
    if (responseCreateDoc.error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error creating ${this.entity} - ${responseCreateDoc.error}`)
      return {
        error: responseCreateDoc.error,
        data: null,
        status: 500
      }
    }

    this.jobDone(job, responseCreateDoc.data, msg)

    // console.info('data', data)
    // console.info('error', error)
    return {
      error: null,
      data: responseCreateDoc.data,
      status: 201
    }
  }

  /**
   * update a AuthorizenetCreditCardPayment Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to update a AuthorizenetCreditCardPayment Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async update (job, msg) {
    return {
      error: 'This transaction can not be updated.',
      data: null,
      status: 409 /* 409 == conflict */
    }
  }

  /**
   * get all AuthorizenetCreditCardPayment Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information to get all Records
   * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getAll (job, msg) {
    // use inherited Service resources
    /**
        get all records using builtin CRUD class
    */

    // job = this.mountWhereByUserType(job)
    const response = await this.getAllRecords(job)
    // { error, data, status, count, pages, limit, page }
    if (response.error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error getting all ${this.entity} records - ${response.error}`)
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
   * get AuthorizenetCreditCardPayment Entity by it Id
   * @function
   * @param {object} job - mandatory - a job object representing the job information to get one Record based on it Id
   * Must contains the _id field
   * job.payload May contains the populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getById (job, msg) {
    // use inherited Service resources
    /**
        Get one data based on ID using builtin CRUD class
    */
    // job = this.mountWhereByUserType(job)
    const {
      error,
      data,
      status
    } = await this.getRecordById(job)
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
    return {
      error,
      data,
      status
    }
  }

  /**
   * get One AuthorizenetCreditCardPayment Entity
   * @function
   * @param {object} job - mandatory - a job object representing the job information get one Record.
   * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async getOne (job, msg) {
    // use inherited Service resources
    /**
        Get one data based on ID using builtin CRUD class
    */
    // job = this.mountWhereByUserType(job)
    const {
      error,
      data,
      status
    } = await this.getOneRecord(job)
    if (error) {
      /**
          set job as not done
      */
      this.jobNotDone(job, msg, `error getting one ${this.entity} data - ${error}`)
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

export default AuthorizenetCreditCardPayment
