import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
// import is from 'is_js'
import { copy } from '../../util'

const Schema = mongoose.Schema

let schemaSettings = null

// console.log('sdfsfdfdsfdsfdsfsdfdsfdsfdsf', is.any.date(new Date(), 'bar'))

schemaSettings = copy(DocumentDefaultProperties, {
  invoice: {
    type: String,
    required: [true, 'Invoice is required.'],
    // unique : true,
    minlength: 1, // authorizenet requirement
    maxlength: 20 // authorizenet requirement
  },
  description: {
    type: String,
    required: [true, 'description is required.']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required.']
  },
  recurringBilling: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    required: [true, 'Status is required.'],
    set: function (value) {
      return value === 201 ? 'Approved' : 'Failed'
    }
  },
  intent: new Schema(
    {
      amount: {
        type: Number,
        required: [true, 'Amount is required.']
      },
      currency: {
        type: String,
        required: [true, 'description is required.'],
        default: 'usd'
      },
      metadata: new Schema({}, { strict: false })
    },
    { strict: false }
  ),
  client_secret: {
    type: String,
    default: ''
  }
})

const schema = new Schema(schemaSettings /* , { versionKey: false } */)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

/** schema.index({
    last_name: 'text',
    first_name: 'text',
    gender: 'text',
    sexual_orientation: 'text',
    ssn: 'text',
}); */

schema.index({ '$**': 'text' })

// Ensure virtual fields are serialised.
schema.set('toJSON', { getters: true, virtuals: true })

schema.method('toClient', function () {
  const obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

schema.plugin(mongoosePaginate)

export const StripeCreditCardPayment = mongoose.model(
  'StripeCreditCardPayment',
  schema
)
