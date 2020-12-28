import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const socialRelationSchema = new Schema({
  who: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Social role is required.']
  },
  whose: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  }
})
