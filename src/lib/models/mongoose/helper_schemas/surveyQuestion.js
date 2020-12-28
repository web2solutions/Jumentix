import mongoose from 'mongoose'
import { surveyAnswerSchema } from './surveyAnswer'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const surveyQuestionSchema = new Schema({
  question: {
    type: String,
    required: [true, 'Question is required.']
  },
  answers: {
    type: [surveyAnswerSchema],
    default: []
  }
})
