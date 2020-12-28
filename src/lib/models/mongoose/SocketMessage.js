import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
const Schema = mongoose.Schema

const schema = new Schema({
  uuid: {
    type: String,
    required: [true, 'uuid is required.']
  },
  from: {
    id: {
      type: String,
      required: [true, 'Client id is required.']
    },
    userId: {
      type: String,
      required: [true, 'User id is required.']
    },
    companyId: {
      type: String,
      required: [true, 'Agency id is required.']
    },
    name: {
      type: String,
      required: [true, 'Name is required.']
    }
  },
  to: {
    id: {
      type: String,
      required: [true, 'Client id is required.'],
      default: '0'
    },
    userId: {
      type: String,
      required: [true, 'User id is required.'],
      default: '0'
    },
    companyId: {
      type: String,
      required: [true, 'Agency id is required.'],
      default: '0'
    },
    name: {
      type: String,
      required: [true, 'Name is required.'],
      default: '0'
    }
  },
  companyId: {
    type: String,
    required: [true, 'Agency id is required.']
  },
  type: {
    type: String,
    required: [true, 'Message type is required.']
  },
  sent: {
    type: Number,
    required: [true, 'sent id is required.'],
    default: 0
  },
  ttl: {
    type: Date,
    required: [true, 'message ttl is required.']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  channel: {
    type: String,
    required: [true, 'channel is required.']
  },
  read: {
    type: [],
    required: [true, 'Read list is required.']
  },
  people: {
    type: [],
    required: [true, 'People list is required.']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required.']
  },
  message: {
    type: String,
    required: [true, 'Message is required.']
  },
  data: {
    type: {},
    required: false,
    default: {}
  },
  items: {
    type: [],
    required: false,
    default: []
  }
})

schema.plugin(mongoosePaginate)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

// Ensure virtual fields are serialised.
schema.set('toJSON', { getters: true, virtuals: true })

schema.method('toClient', function () {
  let obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

schema.index({ '$**': 'text' })
schema.index({ ttl: 1 }, { expireAfterSeconds: 0 })

// schema.index( { "createdAt": 1 }, { expireAfterSeconds: 3600 } )

export const SocketMessage = mongoose.model('SocketMessage', schema)
