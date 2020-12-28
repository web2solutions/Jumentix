import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const taskSurveyAnswerSchema = new Schema({
  who: {
    type: Schema.Types.ObjectId,
    ref: 'Human',
    required: [true, 'Human is required.']
  },
  survey: {
    type: Schema.Types.ObjectId,
    ref: 'Survey',
    required: [true, 'Survey is required.']
  },
  question: { type: Schema.Types.ObjectId },
  answer: {
    type: String,
    required: [true, 'answer is required.']
  },
  startDate: {
    type: Date,
    required: [true, 'Start Date is required.']
  },
  endDate: {
    type: Date
  }
})
