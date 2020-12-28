import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

import { sub_roleSchema } from './helper_schemas/sub_role'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId,
  schemaSettings = null

schemaSettings = copy(DocumentDefaultProperties, {
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'role is required.']
  },
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

export const SubRole = mongoose.model('SubRole', schema)
