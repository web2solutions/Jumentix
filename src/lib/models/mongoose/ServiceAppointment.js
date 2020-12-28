import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import is from 'is_js'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
// import { appointmentSessionSchema } from './helper_schemas/appointmentSession'
import { memoSchema } from './helper_schemas/memo'
import { billAndShipToSchema } from './helper_schemas/billAndShipTo'
import { copy } from '../../util'

const Schema = mongoose.Schema
let schemaSettings = null

// copy createdAt, updatedAt, createdBy, updatedBy, _history
schemaSettings = copy(DocumentDefaultProperties, {
  service: { type: Schema.Types.ObjectId, ref: 'Service', populate: true },
  title: {
    type: String,
    required: [true, 'Service Appointment title is required.']
  },
  description: {
    type: String,
    required: [true, 'Service Appointment description is required.']
  },
  attendant: { type: Schema.Types.ObjectId, ref: 'Human', populate: true, required: [true, 'Service Appointment attendant is required.'] },
  attendee: { type: Schema.Types.ObjectId, ref: 'Human', populate: true, required: [true, 'Service Appointment attendee is required.'] },
  unity: {
    type: String,
    required: [true, 'Unity is required.'],
    default: 'Hour',
    enum: ['Day', 'Hour']
  },
  duration: {
    type: Number,
    // required: [true, 'quantity is required.'],
    default: 1,
    validate: {
      validator: function (v) {
        if (is.not.number(v)) {
          return false
        }
        return v > 0.5
      },
      message: (props) => `${props.value} must be a number greater than 0.5!`
    }
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: Date.now
  },
  /* quantity: {
    type: Number,
    // required: [true, 'quantity is required.'],
    default: 1,
    validate: {
      validator: function (v) {
        if (is.not.integer(v)) {
          return false
        }
        return v > 0
      },
      message: (props) => `${props.value} must be a integer greater than 0!`
    }
  }, */
  /* session: {
    type: [appointmentSessionSchema],
    default: []
  }, */
  read: {
    type: Boolean,
    default: false
  },
  paymentType: {
    type: String,
    required: [true, 'Payment type is required.'],
    default: 'Credit Card',
    enum: ['Credit Card']
  },
  dueDate: {
    type: Date,
    default: Date.now
  },
  paidDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    required: [true, 'Status is required.'],
    default: 'Open',
    enum: ['Open', 'Closed', 'Paid', 'Overdue', 'Deleted', 'Canceled']
  },
  billTo: {
    type: [billAndShipToSchema],
    default: []
  },
  shipTo: {
    type: [billAndShipToSchema],
    default: []
  },
  memo: {
    type: [memoSchema],
    default: []
  }
})

const schema = new Schema(schemaSettings /* , { versionKey: false } */)

schema.plugin(mongoosePaginate)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

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

export const ServiceAppointment = mongoose.model('ServiceAppointment', schema)
