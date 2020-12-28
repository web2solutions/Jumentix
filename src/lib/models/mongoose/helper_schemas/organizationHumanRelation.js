import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const organizationHumanRelationSchema = new Schema({
  human: {
    type: Schema.Types.ObjectId,
    ref: 'Human',
    required: [true, 'Human is required.']
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role is required.']
  },
  boss_level: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  }
})
