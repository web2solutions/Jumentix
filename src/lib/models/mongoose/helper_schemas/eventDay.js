import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const eventDaySchema = new Schema({
  label: {
    type: String,
    required: [true, 'Label is required.']
  },
  start: {
    type: Date,
    required: [true, 'Start is required.']
  },
  end: {
    type: String,
    required: [true, 'End is required.']
  },
  price: {
    type: Number,
    default: 0
  },
  location: {
    type: String
  }
})
