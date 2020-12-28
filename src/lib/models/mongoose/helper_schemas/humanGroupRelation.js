import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const humanGroupRelationSchema = new Schema({
  group: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Group is required.']
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
