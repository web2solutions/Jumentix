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
    required: [true, 'Entity name is required.'],
    index: { unique: true }
  },
  type: {
    type: String,
    required: [true, 'Entity type is required.'],
    enum: ['Data', 'File', 'Message']
  },
  engine: {
    type: String,
    required: [true, 'engine is required.'],
    enum: ['mongo', 'sequelize', 'file_system', 'gmail', 'mailgun']
  }
})

let schema = new Schema(schemaSettings /* , { versionKey: false }*/)

schema.plugin(mongoosePaginate)

schema.virtual('id').get(function () {
  return this._id.toHexString()
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

export const Entity = mongoose.model('Entity', schema)
