import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const templateSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required.']
  },
  type: {
    type: String,
    required: [true, 'Type is required.'],
    enum: ['E-mail', 'Invoice']
  },
  title: {
    type: String,
    required: [true, 'Title is required.']
  },
  body: {
    type: String,
    required: [true, 'Body is required.']
  }
})
