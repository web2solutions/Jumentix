import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const familyServiceRelationSchema = new Schema(
  {
    who: {
      type: Schema.Types.ObjectId,
      ref: 'Human',
      required: [true, 'Who is required.']
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'Service role is required.']
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
  },
  { strict: false }
)
