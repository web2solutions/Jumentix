import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import moment from 'moment-timezone'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId,
  schemaSettings = null

schemaSettings = copy(DocumentDefaultProperties, {
  entity: {
    type: String,
    required: [true, 'Entity is required.']
  },
  document_id: {
    type: String,
    required: [true, 'document_id is required.']
  },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'Human', required: true },
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

let schema = new Schema(schemaSettings /* , { versionKey: false }*/)

schema.plugin(mongoosePaginate)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

schema.index({ ttl: 1 }, { expireAfterSeconds: 0 })
schema.index({ '$**': 'text' })

// Ensure virtual fields are serialised.
schema.set('toJSON', { getters: true, virtuals: true })

schema.method('toClient', function () {
  let obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

export const Trash = mongoose.model('Trash', schema)
