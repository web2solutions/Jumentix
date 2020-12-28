import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

const Schema = mongoose.Schema
// const ObjectId = Schema.ObjectId
let schemaSettings = null

schemaSettings = copy(DocumentDefaultProperties, {
  title: {
    type: String,
    required: [true, 'Title is required.']
  },
  description: {
    type: String,
    required: [true, 'Description is required.']
  },
  user: { type: Schema.Types.ObjectId, ref: 'User', populate: true },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
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

export const Appointment = mongoose.model('Appointment', schema)
