import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId,
  schemaSettings = null

schemaSettings = copy(DocumentDefaultProperties, {
  name: {
    type: String,
    required: [true, 'Name is required.'],
    unique: true
  },
  label: {
    type: String,
    required: [true, 'Name is required.'],
    unique: true
  },
  type: {
    type: String,
    default: 'Family',
    enum: ['Family', 'Service', 'Social', 'Couple', 'Other']
  },
  canDelete: {
    type: Boolean,
    default: true
  }
})

let schema = new Schema(schemaSettings /* , { versionKey: false }*/)

schema.plugin(mongoosePaginate)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

schema.virtual('abbreviation').get(function () {
  return this.name
})

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

export const Role = mongoose.model('Role', schema)
