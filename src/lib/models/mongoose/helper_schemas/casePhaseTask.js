import { fileSchema } from './file'
import { memoSchema } from './memo'
import mongoose from 'mongoose'
import { taskProgressSchema } from './taskProgress'
import { taskSurveyAnswerSchema } from './taskSurveyAnswer'

const Schema = mongoose.Schema

export const casePhaseTaskSchema = new Schema({
  task_template: {
    type: Schema.Types.ObjectId,
    ref: 'TaskTemplate'
  },
  who: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  expireDate: {
    type: Date
  },
  order: {
    type: Number,
    required: [true, 'Order is required.'],
    default: 0
  },
  task: {
    type: Array,
    default: []
  },
  progress: {
    type: [taskProgressSchema],
    default: []
  },
  survey: {
    type: [taskSurveyAnswerSchema],
    default: []
  },
  status: {
    type: Schema.Types.ObjectId,
    ref: 'TaskStatus'
  },
  memo: {
    type: [memoSchema],
    default: []
  },
  file: {
    type: [fileSchema],
    default: []
  }
})
