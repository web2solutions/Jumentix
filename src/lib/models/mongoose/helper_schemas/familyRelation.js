import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const familyRelationSchema = new Schema({
  who: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Family relation role is required.']
  },
  sub_role: { type: Schema.Types.ObjectId, ref: 'SubRole' },
  whose: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  type: {
    type: String,
    enum: ['Biological', 'Adoptive', 'Step', 'Couple']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  }
})
