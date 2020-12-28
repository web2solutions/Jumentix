'use strict'
import moment from 'moment-timezone'
import {
  uuid,
  isDefined,
  // isNumber,
  // isArray,
  // isEmail,
  // sanitizeString,
  copy
  // isDate
} from './util'
import config from '../config'
const env = process.env.NODE_ENV || 'development'

moment.tz.setDefault(config[env].timezone)

class RabbitEnvelop {
  constructor (envelop) {
    let fromCopy = {}
    const utcDate = moment.utc() /* .format() */
    const dateNow = utcDate.toISOString()

    // checkings
    if (!isDefined(envelop.entity)) {
      throw Error('cant compose, undefined entity')
    }
    if (!isDefined(envelop.action)) {
      throw Error('cant compose, undefined action')
    }
    if (!isDefined(envelop.from)) {
      throw Error('cant compose, undefined from')
    }
    if (!isDefined(envelop.from.companyId)) {
      throw Error('cant compose, undefined from companyId - rabbitenv')
    }

    if (!isDefined(envelop.from.name)) {
      throw Error('cant compose, undefined name')
    }

    /* if( ! isNumber(envelop.from.companyId)  )
        {
            throw 'cant compose, companyId need to a number'
        } */
    if (!isDefined(envelop.from.user_email)) {
      throw Error('cant compose, undefined user_email')
    }

    if (isDefined(envelop.to)) {
      if (!isDefined(envelop.to.id)) {
        envelop.to.id = uuid()
      }
      if (!isDefined(envelop.to.companyId)) {
        throw Error('cant compose, undefined to companyId - rabbitenv')
      }

      if (!isDefined(envelop.to.name)) {
        throw Error('cant compose, undefined name')
      }

      /* if( ! isNumber(envelop.to.companyId)  )
            {
                throw 'cant compose, companyId need to a number'
            } */
      if (!isDefined(envelop.to.user_email)) {
        throw Error('cant compose, undefined user_email')
      }
    }

    this.uuid = envelop.uuid || uuid() // type guid mandatory
    this.from = envelop.from // type user mandatory

    this.to = envelop.to || false

    this.companyId = config[env].companyCode || 1

    this.createdAt = envelop.createdAt || dateNow
    this.updatedAt = envelop.updatedAt || dateNow

    this.entity = envelop.entity
    this.action = envelop.action

    this.payload = envelop.payload || {}
    this.data = envelop.data || {}

    this.success = envelop.success || false
    this.error = envelop.error || false

    this.status = envelop.status || 'awaiting'

    this.source = config[env].name

    this.message = envelop.message || 'New message from ' + envelop.from.name
    this.subject = envelop.subject || 'New message from ' + envelop.from.name

    // console.log(`keys ${Object.keys(envelop.from)}`)

    if (this.from) {
      delete this.from.session
      // this.from.human = this.from.human._id
    }

    if (this.to) {
      delete this.to.session
      // this.to.human = this.to.human._id
    }

    fromCopy = copy(this.from)

    if (!this.to) {
      this.to = fromCopy
    }
  }
}

export default RabbitEnvelop
