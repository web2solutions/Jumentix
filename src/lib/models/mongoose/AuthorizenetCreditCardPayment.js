import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { billAndShipToSchema } from './helper_schemas/billAndShipTo'
import { invoiceAdditionalCostSchema } from './helper_schemas/invoiceAdditionalCost'

// import is from 'is_js'
import {
  copy
} from '../../util'
// import path from 'path'

const Schema = mongoose.Schema
let schemaSettings = null

// console.log('sdfsfdfdsfdsfdsfsdfdsfdsfdsf', is.any.date(new Date(), 'bar'))

schemaSettings = copy(DocumentDefaultProperties, {
  invoice: {
    type: String,
    required: [
      true, 'Invoice is required.'
    ],
    // unique : true,
    minlength: 1, // authorizenet requirement
    maxlength: 20 // authorizenet requirement
  },
  description: {
    type: String,
    required: [
      true, 'description is required.'
    ]
  },
  amount: {
    type: Number,
    required: [
      true, 'Amount is required.'
    ]
  },
  recurringBilling: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    required: [
      true, 'Status is required.'
    ],
    set: function (value) {
      return value === 201 ? 'Approved' : 'Failed'
    }
  },
  transactionId: {
    type: String,
    required: [
      true, 'transactionId is required.'
    ]
  },
  orderDetails: new Schema({
    refId: {
      type: String,
      required: [
        true, 'orderDetails.refId is required.'
      ]
    },
    description: {
      type: String,
      required: [
        true, 'orderDetails.description is required.'
      ]
    }
  }),
  creditCard: new Schema({
    number: {
      type: String,
      required: [
        true, 'Number is required.'
      ],
      set: function (cc) {
        return '****-****-****-' + cc.slice(cc.length - 4, cc.length)
      }
    },
    expiration_date: {
      type: String,
      required: [
        true, 'expiration_date is required.'
      ]
    },
    code: {
      type: String,
      required: [
        true, 'Code is required.'
      ],
      set: function () {
        return '***'
      }
    }
  }),

  tax: invoiceAdditionalCostSchema,

  duty: invoiceAdditionalCostSchema,

  shipping: invoiceAdditionalCostSchema,

  billTo: billAndShipToSchema,

  shipTo: billAndShipToSchema,

  products: [new Schema({
    id: {
      type: String,
      required: [
        true, 'id is required.'
      ]
    },
    name: {
      type: String,
      required: [
        true, 'name is required.'
      ]
    },
    quantity: {
      type: Number,
      required: [
        true, 'quantity is required.'
      ]
    },
    unit_price: {
      type: Number,
      required: [
        true, 'Unit price is required.'
      ]
    }
  })],

  response: new Schema({}, {
    strict: false
  })
})

const schema = new Schema(schemaSettings /* , { versionKey: false } */)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

schema.index({
  '$**': 'text'
})

// Ensure virtual fields are serialised.
schema.set('toJSON', {
  getters: true,
  virtuals: true
})

schema.method('toClient', function () {
  const obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

schema.plugin(mongoosePaginate)

export const AuthorizenetCreditCardPayment = mongoose.model('AuthorizenetCreditCardPayment', schema)
