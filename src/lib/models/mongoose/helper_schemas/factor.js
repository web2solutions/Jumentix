import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const factorSchema = new Schema({
  medical: {
    type: Number,
    required: [true, 'Number is required.']
  },
  age: {
    type: Number,
    required: [true, 'Age is required.']
  }
})
