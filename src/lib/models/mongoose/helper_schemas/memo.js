import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const memoSchema = new Schema({
  memo: {
    type: String,
    required: [true, 'Memo is required.']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // date when document was updated
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  }
})
