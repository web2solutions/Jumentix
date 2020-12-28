import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const groupServiceRelationSchema = new Schema({
  human: {
    type: Schema.Types.ObjectId,
    ref: 'Human',
    required: [true, 'Human is required.']
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: 'GroupRole',
    required: [true, 'Role is required.']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  }
})
