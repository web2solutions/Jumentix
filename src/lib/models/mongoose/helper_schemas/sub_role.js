import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const sub_roleSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required.']
  },
  label: {
    type: String,
    required: [true, 'Label is required.']
  },
  canDelete: {
    type: Boolean,
    default: true
  }
})
