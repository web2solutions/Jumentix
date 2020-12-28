import mongoose from 'mongoose'

const Schema = mongoose.Schema

export const taskProgressReviewSchema = new Schema({
  who: {
    type: Schema.Types.ObjectId,
    ref: 'Human',
    required: [true, 'Human is required.']
  },
  status: {
    type: String,
    required: [true, 'Event is required.'],
    enum: [
      'Initial Open',
      'Submit',
      'Approved',
      'Approved/Override',
      'Rejected'
    ],
    default: 'Initial Open'
  },
  startDate: {
    type: Date,
    required: [true, 'Start Date is required.']
  },
  endDate: {
    type: Date
  },
  memo: {
    type: String
  }
})
