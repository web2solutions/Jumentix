import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const fileSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required.']
  },
  file: {
    type: String,
    required: [true, 'file is required.']
  },
  label: {
    type: String,
    required: [true, 'label is required.']
  },
  mimetype: {
    type: String,
    required: [true, 'Mime Type is required.']
  },
  path: {
    type: String,
    required: [true, 'Path is required.']
  },
  webPath: {
    type: String,
    required: [true, 'webPath is required.']
  },
  size: {
    type: Number,
    required: [true, 'Size is required.']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  memo: String
})
