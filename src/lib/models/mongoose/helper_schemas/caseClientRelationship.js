import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const caseClientRelationshipSchema = new Schema({
  who: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Case relation role is required.']
  },
  sub_role: { type: Schema.Types.ObjectId, ref: 'SubRole' },
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
