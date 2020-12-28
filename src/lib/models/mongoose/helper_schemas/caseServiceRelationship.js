import mongoose from 'mongoose'

const Schema = mongoose.Schema

export const caseServiceRelationshipSchema = new Schema({
  who: {
    type: Schema.Types.ObjectId,
    ref: 'Human',
    required: [true, 'who ID is required.']
  },
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Role ID is required.']
  },
  hierarquy: {
    type: String,
    required: [true, 'Hierarquy is required.'],
    default: 'primary' // primary, secondary, tertiary
  },
  // hierarquy .... primary, secondary .....

  whose: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  startDate: {
    type: Date,
    required: [true, 'Start Date is required.']
  },
  endDate: {
    type: Date
  },
  isOutside: {
    type: Boolean,
    default: false
  }
})
