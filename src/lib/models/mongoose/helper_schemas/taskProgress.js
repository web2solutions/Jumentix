import mongoose from 'mongoose'
import { taskProgressReviewSchema } from './taskProgressReview'
import { fileSchema } from './file'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const taskProgressSchema = new Schema({
  who: {
    type: Schema.Types.ObjectId,
    ref: 'Human',
    required: [true, 'Human is required.']
  },
  startDate: {
    type: Date,
    required: [true, 'Start Date is required.']
  },
  endDate: {
    type: Date
  },
  review: {
    type: [taskProgressReviewSchema],
    default: []
  },
  payment_transaction: {
    type: Array,
    default: []
  },
  file: {
    type: [fileSchema],
    default: []
  }
})
