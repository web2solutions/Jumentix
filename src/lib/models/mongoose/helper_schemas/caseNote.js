import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const caseNoteSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'Human', required: true },
  type: { type: Schema.Types.ObjectId, ref: 'CaseNoteType', required: true },
  form: {
    type: String
  },
  subject: {
    type: String,
    required: [true, 'Subject is required.']
  },
  note: {
    type: String,
    required: [true, 'Note is required.']
  },
  priority: {
    type: String,
    required: [true, 'Priority is required.'],
    default: 'Normal',
    enum: ['High', 'Medium', 'Normal', 'Low']
  },
  incident: {
    type: String,
    required: [true, 'Incident is required.'],
    default: 'No',
    enum: ['Yes', 'No']
  },
  bill_code: {
    type: String
  },
  drawee: { type: Schema.Types.ObjectId, ref: 'Wallet' },
  duration_hour: {
    type: Number,
    default: 0
  },
  duration_minute: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  }
})
