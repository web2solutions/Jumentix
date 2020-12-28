import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import { copy } from '../../util'
import DocumentDefaultProperties from '../DocumentDefaultProperties'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId,
  schemaSettings = null
// copy createdAt, updatedAt, createdBy, updatedBy, _history

schemaSettings = copy(DocumentDefaultProperties, {
  // ---------
  uuid: {
    type: String,
    default: ''
  },
  from: Schema.Types.Mixed,
  to: Schema.Types.Mixed,
  companyId: {
    type: Number,
    default: 0
  },
  entity: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    default: ''
  },
  payload: Schema.Types.Mixed,
  data: Schema.Types.Mixed,
  success: {
    type: Boolean,
    default: false
  },
  error: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  subject: {
    type: String,
    default: ''
  }
})

let schema = new Schema(schemaSettings, {
  /* versionKey: false,*/ strict: false
})

schema.plugin(mongoosePaginate)

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
  let obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

export const JobLog = mongoose.model('JobLog', schema)
