import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import is from 'is_js'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

const Schema = mongoose.Schema
let schemaSettings = null

// copy createdAt, updatedAt, createdBy, updatedBy, _history
schemaSettings = copy(DocumentDefaultProperties, {
  name: {
    type: String,
    required: [true, 'Service name is required.']
  },
  description: {
    type: String,
    required: [true, 'Service description is required.']
  },
  // type: { type: Schema.Types.ObjectId, ref: 'ServiceType', populate: true },
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
  unityCost: {
    type: Number,
    // required : [
    //    true, 'Unity cost is required.'
    // ],
    default: 0,
    validate: {
      validator: function (v) {
        return is.number(v)
      },
      message: (props) => `${props.value} is not a valid number!`
    }
  },
  unityPrice: {
    type: Number,
    // required : [
    //    true, 'Unity price is required.'
    // ],
    default: 0,
    validate: {
      validator: function (v) {
        return is.number(v)
      },
      message: (props) => `${props.value} is not a valid number!`
    }
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

export const Service = mongoose.model('Service', schema)
