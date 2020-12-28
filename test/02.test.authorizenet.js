/* global describe, it */

import http from 'http'
import assert from 'assert'
import request from 'request'
import config from '../src/config'
import {
  // isDefined,
  // isArray,
  isNumber,
  gen6Digs
} from '../src/lib/util'
import {
  sha512
} from 'js-sha512'

const env = process.env.NODE_ENV || 'development'
const conf = config[env]
const host = `http://${conf.server.ip}:${conf.server.port}`

const adminUser = {
  username: 'admin@admin.com',
  password: sha512.hex('123456')
}

let loggedUser = null

let token = ''
let serviceObj = ''
let foundService = false
let createdCustomer = false

// console.log( 'host', host  )

const parentPayload = {
  email: ((new Date()).getTime()) + 'web2solucoes@gmail.com',
  first_name: 'Eduardo',
  last_name: 'Almeida',
  phone: '+55-27-99737-5850', // +1-444-222-3333,
  bestTimeToCall: 'Afternoon',
  notifyBy: 'email' // sms, email
}

const servicePayload = {
  name: 'Basic Counseling XXX',
  description: 'Basic Counseling XXX',
  unity: 'Hour',
  unityCost: 10,
  unityPrice: 100,
  duration: 1
}

const serviceAppointmentPayload = {
  service: null,
  title: 'Meet doctor',
  description: 'Meet doctor at home',
  attendant: '5c78a060c15bca840749e44b',
  attendee: '5c78a060c15bca840749e44b',
  unity: 'Hour',
  duration: 1,
  startDate: '2017-07-21T17:32:28Z',
  endDate: '2017-07-21T17:32:28Z',
  read: false,
  paymentType: [
    'Credit Card'
  ],
  dueDate: '2019-05-21',
  paidDate: '2019-05-20',
  status: 'Open',
  billTo: [
    {
      first_name: 'Thomas',
      last_name: 'Issac',
      company: 'Issac',
      address: '1120 N Street',
      city: 'Los Angeles',
      state: 'California',
      country: 'United States of America',
      zip: 942873
    }
  ],
  shipTo: [
    {
      first_name: 'Thomas',
      last_name: 'Issac',
      company: 'Issac',
      address: '1120 N Street',
      city: 'Los Angeles',
      state: 'California',
      country: 'United States of America',
      zip: 942873
    }
  ]
}
const invN = 'INV-' + gen6Digs()
const invD = 'Invoice Description'
const ccPayload = {
  invoice: invN,
  description: invD,
  creditCard: {
    number: '4242424242424242',
    expiration_date: '0822',
    code: '999'
  },
  orderDetails: {
    refId: invN,
    description: invD
  },
  tax: {
    amount: 4.26,
    name: 'level2 tax name',
    description: 'level2 tax'
  },
  duty: {
    amount: 4.26,
    name: 'duty name',
    description: 'duty description'
  },
  shipping: {
    amount: 4.26,
    name: 'shipping name',
    description: 'shipping description'
  },
  billTo: {
    first_name: 'Ellen',
    last_name: 'Johnson',
    company: 'Souveniropolis',
    address: '14 Main Street',
    city: 'Pecan Springs',
    state: 'TX',
    zip: '44628',
    country: 'United States of America'
  },
  shipTo: {
    first_name: 'Ellen',
    last_name: 'Johnson',
    company: 'Souveniropolis',
    address: '14 Main Street',
    city: 'Pecan Springs',
    state: 'TX',
    zip: '44628',
    country: 'United States of America'
  },
  products: [{
    id: '1',
    name: 'Support service',
    description: 'Monthly support service',
    quantity: '1',
    unit_price: 4.26
  }],
  recurringBilling: false,
  amount: 8
}

describe('#--- Service Appointment Workflow Test Suite', () => {
  describe('Check if API is online', () => {
    // Server Online
    it('Getting API root address should return 404 (Not Found) (No defined End Point)', done => {
      http.get(host, res => {
        // console.log(res)
        assert.equal(404, res.statusCode)
        done()
      })
    })
  })

  describe('Register Client Test Suite -> ', () => {
    describe('testing POST /api/User/Register', () => {
      // =======>
      it('Sending valid payload should return 201 (Created)', done => {
        const options = {
          method: 'POST',
          url: `${host}/api/User/Register`,
          json: parentPayload
        }
        request(options, function (error, res, body) {
          // console.log( body )
          if (error) {
            throw new Error(error)
          }
          createdCustomer = body.data
          // console.log(createdCustomer, res.statusCode)
          assert.equal(201, res.statusCode)
          done()
        })
      }).timeout(10000)
    })
    describe('Validating registered Customer', () => {
      // =======>
      it('User must have parent role', done => {
        assert.equal(createdCustomer.user.roles[0], 'parent')
        done()
      })
      it('User must be unactive', done => {
        assert.equal(createdCustomer.user.active, false)
        done()
      })
      it('User must have portal access', done => {
        assert.equal(createdCustomer.user.portal_access, true)
        done()
      })
      it('User must change password on next login', done => {
        assert.equal(createdCustomer.user.changePasswordNextLogin, true)
        done()
      })
      it('User must have an activationCode', done => {
        assert.equal(typeof createdCustomer.user.activationCode !== 'undefined', true)
        done()
      })
      it('User must have a reset code', done => {
        assert.equal(typeof createdCustomer.user.resetCode !== 'undefined', true)
        done()
      })
      it('User must have a associated human', done => {
        assert.equal(typeof createdCustomer.user.human !== 'undefined', true)
        done()
      })
    })

    describe('Activating registered customer', () => {
      // =======>
      it('Registered customer must be now active', done => {
        assert.equal(true, false)
        done()
      })
      it('Password must works', done => {
        assert.equal(true, false)
        done()
      })
    })
    describe('To pay for a Service Appointment, you need to have a Service created in database first', () => {
      it('/auth/local should return 200 (Login Success)', done => {
        const options = {
          method: 'POST',
          url: `${host}/auth/local`,
          json: adminUser
        }
        request(options, function (error, res, body) {
          // console.log( body )
          if (error) {
            throw new Error(error)
          }
          token = body.token
          loggedUser = body.user
          // set service appointment attendant
          serviceAppointmentPayload.attendant = loggedUser._id
          assert.equal(200, res.statusCode)
          done()
        })
      })
      // =======>
      it('To test POST /api/Service and create a service', done => {
        const options = {
          method: 'POST',
          url: `${host}/api/Service`,
          json: servicePayload,
          headers: {
            authorization: `Bearer ${token}`
          }
        }
        request(options, function (error, res, b) {
          if (error) {
            throw new Error(error)
          }
          const body = b
          assert.equal(201, res.statusCode)
          assert.equal(servicePayload.name, body.data.name)
          serviceObj = body.data || {}
          done()
        })
      })
      // =======>
      it('To test GET /api/Service/{id} and get the created service', done => {
        const options = {
          method: 'GET',
          url: `${host}/api/Service/${serviceObj._id}`,
          headers: {
            authorization: `Bearer ${token}`
          }
        }
        request(options, function (error, res, b) {
          if (error) {
            throw new Error(error)
          }
          const body = b
          assert.equal(200, res.statusCode)
          assert.equal(servicePayload.name, body.data.name)
          serviceObj = body.data || {}
          done()
        })
      })
      // =======>
      it('To test GET /api/Service and check if created service is listed', done => {
        const options = {
          method: 'GET',
          url: `${host}/api/Service`,
          headers: {
            authorization: `Bearer ${token}`
          }
        }
        request(options, function (error, res, b) {
          // console.log(b)
          if (error) {
            throw new Error(error)
          }
          const body = JSON.parse(b)
          // console.log('xxx', body)
          assert.equal(200, res.statusCode)
          // assert.equal(true, body.data.length > 0)
          // serviceObj = body.data[0] || null
          body.data.forEach(s => {
            if (s._id === serviceObj._id) {
              foundService = true
            }
          })
          assert.equal(true, foundService)
          done()
        })
      })
      // =======>
      it('created service duration must be number', done => {
        assert.equal(true, isNumber(serviceObj.duration))
        done()
      })
      // =======>
      it('created service duration must be greater than 0', done => {
        assert.equal(true, serviceObj.duration > 0)
        done()
      })
      // =======>
      it('created service unityCost must be number', done => {
        assert.equal(true, isNumber(serviceObj.unityCost))
        done()
      })
      // =======>
      it('created service unityPrice must be number', done => {
        assert.equal(true, isNumber(serviceObj.unityPrice))
        done()
      })
    })
    describe('Customer complete process: select service and pay for it', () => {
      // =======>
      it('Registered customer need to able to login', done => {
        assert.equal(true, false)
        done()
      })
      it('Registered customer need to select a service', done => {
        assert.equal(true, false)
        done()
      })
      it('Registered customer need to be able to schedule a Service Appointment', done => {
        assert.equal(true, false)
        done()
      })
      it('Registered customer need to be able to pay for a Service Appointment using Credi Card', done => {
        assert.equal(true, false)
        done()
      })
    })
    describe('Payment validation', () => {
      // =======>
      it('Payment must be executed with success over Auhorize.net', done => {
        assert.equal(true, false)
        done()
      })
    })
  })

  describe('Workflow suite -> ', () => {
    describe('To pay for a Service Appointment, you need to have a Service Appointment created in database first', () => {
      it('To test POST /api/ServiceAppointment and create a Service Appointment', done => {
        assert.equal(201, 0)
        done()
      })
      // =======>
      it('To test GET /api/ServiceAppointment/{id} and get the created service', done => {
        assert.equal(201, 0)
        done()
      })
      // =======>
      it('To test GET /api/ServiceAppointment and check if created service is listed', done => {
        assert.equal(201, 0)
        done()
      })
      it('created Service Appointment duration must be number', done => {
        assert.equal(201, 0)
        done()
      })
      it('created Service Appointment duration must be greater than 0', done => {
        assert.equal(201, 0)
        done()
      })
      it('created Service Appointment must have attendant', done => {
        assert.equal(201, 0)
        done()
      })
      it('created Service Appointment must have attendee', done => {
        assert.equal(201, 0)
        done()
      })
      it('created Service Appointment must have startDate', done => {
        assert.equal(201, 0)
        done()
      })
      it('created Service Appointment must have endDate', done => {
        assert.equal(201, 0)
        done()
      })
    })

    describe('Auhorize.net testing', () => {
      describe('calling /api/AuthorizenetCreditCardPayment with fake payment', () => {
        it('Payment must be approved', done => {
          const options = {
            method: 'POST',
            url: `${host}/api/AuthorizenetCreditCardPayment`,
            json: ccPayload,
            headers: {
              authorization: `Bearer ${token}`
            }
          }
          request(options, function (error, res, b) {
            // console.log(b)
            if (error) {
              throw new Error(error)
            }
            const body = b
            assert.equal(201, res.statusCode)
            done()
          })
        }).timeout(5000)
      })
    })

    describe('Logout testing', () => {
      it('/api/auth/logout should return 200 (Logout)', done => {
        const options = {
          method: 'DELETE',
          url: `${host}/api/auth/logout`,
          headers: {
            authorization: `Bearer ${token}`
          }
        }
        request(options, function (error, res, body) {
          if (error) {
            throw new Error(error)
          }
          assert.equal(200, res.statusCode)
          done()
        })
      })
    })
  })
})
