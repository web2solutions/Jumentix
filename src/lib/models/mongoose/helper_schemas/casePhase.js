import { casePhaseTaskSchema } from './casePhaseTask'
import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const casePhaseSchema = new Schema({
  group: {
    type: Schema.Types.ObjectId,
    ref: 'Group'
  },
  phase: {
    type: Schema.Types.ObjectId,
    ref: 'Phase'
  },
  order: {
    type: Number,
    required: [true, 'Order is required.'],
    default: 0
  },
  task: {
    type: [casePhaseTaskSchema],
    default: []
  }
})
