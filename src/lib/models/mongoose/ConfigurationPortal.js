import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

const Schema = mongoose.Schema
let schemaSettings = null

// copy createdAt, updatedAt, createdBy, updatedBy, _history
schemaSettings = copy(DocumentDefaultProperties, {
  title: {
    type: String,
    required: [true, 'Title is required.'],
    default: 'Demo'
  },
  logo: {
    type: String,
    required: [true, 'Logo is required.'],
    default: '/static/logo.png'
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

export const ConfigurationPortal = mongoose.model('ConfigurationPortal', schema)
