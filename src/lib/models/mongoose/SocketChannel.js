import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import moment from 'moment-timezone'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId,
  schemaSettings = null

schemaSettings = copy(DocumentDefaultProperties, {
  uuid: {
    type: String,
    required: [true, 'uuid is required.']
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    required: [true, 'Type is required.'],
    enum: ['talk', 'personal'] // group
  },
  name: {
    type: String,
    required: [true, 'Name is required.']
  },
  people: {
    type: [],
    default: []
  },
  messages: {
    type: [],
    default: []
  }
})

let schema = new Schema(schemaSettings /* , { versionKey: false }*/)

schema.plugin(mongoosePaginate)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

// schema.index({ ttl: 1 }, { expireAfterSeconds : 0 });
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

export const SocketChannel = mongoose.model('SocketChannel', schema)
