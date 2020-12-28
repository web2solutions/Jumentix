import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const surveyAnswerSchema = new Schema({
  value: {
    type: String,
    required: [true, 'Value is required.']
  },
  label: {
    type: String,
    required: [true, 'Label is required.']
  }
})
