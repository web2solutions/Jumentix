import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import moment from 'moment-timezone'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

const Schema = mongoose.Schema
let schemaSettings = null

schemaSettings = copy(DocumentDefaultProperties, {
  entity: {
    type: String,
    required: [true, 'Entity is required.']
  },
  document_id: {
    type: String,
    required: [true, 'document_id is required.']
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Human', required: true },
  version: {
    type: Number,
    required: [true, 'Version is required.']
  },
  document: {
    type: Object,
    default: {}
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

export const History = mongoose.model('History', schema)
