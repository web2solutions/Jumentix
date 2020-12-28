import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import moment from 'moment-timezone'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

const Schema = mongoose.Schema
const ObjectId = Schema.ObjectId
let schemaSettings = null

schemaSettings = copy(DocumentDefaultProperties, {
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  date: {
    type: Date,
    required: [true, 'date is required.']
  },
  device: {
    type: String,
    default: ''
  },
  os: {
    type: String,
    default: ''
  },
  session_id: {
    type: String,
    default: ''
  },
  browser: {
    type: String,
    default: ''
  },
  user_agent: {
    type: String,
    default: ''
  },
  ip: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  geolocation: {
    type: String,
    default: ''
  },
  ttl: {
    type: Date,
    required: [true, 'message ttl is required.'],
    default: moment.utc().add(730, 'd').toISOString() // 2 years
  }
})

const schema = new Schema(schemaSettings /* , { versionKey: false } */)

schema.plugin(mongoosePaginate)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

schema.index({ ttl: 1 }, { expireAfterSeconds: 0 })
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

export const UserAccess = mongoose.model('UserAccess', schema)
