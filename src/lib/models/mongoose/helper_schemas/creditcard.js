import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const creditcardSchema = new Schema({
  number: {
    type: String,
    required: [true, 'Number is required.']
  },
  expiration_date: {
    type: Date,
    default: Date.now
  },
  code: {
    type: String,
    required: [true, 'Code is required.']
  }
})
