import mongoose from 'mongoose'
import { taskProgressReviewSchema } from './taskProgressReview'
import { taskRuleSchema } from './taskRule'
import { taskProgressSchema } from './taskProgress'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const taskDefaultProperties = {
  name: {
    type: String,
    required: [true, 'Name is required.']
  },
  description: {
    type: String,
    required: [true, 'Description is required.']
  },
  type: {
    type: String,
    required: [true, 'Type is required.'],
    enum: [
      'Group of task',
      'Document Upload',
      'Event Signup',
      'Form - Internal',
      'Form - External',
      'Data merge with/without signature',
      'URL',
      'Document Download',
      'Survey',
      'Reference',
      'Payment'
    ],
    default: 'Survey'
  },
  notification_type: {
    type: String,
    required: [true, 'Notification Type is required.'],
    enum: [
      'No Notification',
      'Notify Assigned Caseworker(s)',
      'Notify Caseworker(s) and Message Group',
      'Notify Message Group',
      'Notify Caseworker(s) On Each Submission',
      'Notify Assigned Caseworker(s) and Message Group'
    ],
    default: 'No Notification'
  },

  caseworker: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Human' }],
    default: []
  },
  auto_approve: {
    type: Boolean,
    required: [true, 'Auto Approve is required.'],
    default: false
  },
  status: { type: Schema.Types.ObjectId, ref: 'TaskStatus', required: true },
  progress: {
    type: [taskProgressSchema],
    default: []
  },
  disable: {
    type: Boolean,
    required: [true, 'Disable is required.'],
    default: false
  },
  /* isPublic :
    {
        type : Boolean,
        required : [
            true, 'IsPublic is required.'
        ],
        default : false
    },*/
  expire_unit: {
    type: String,
    required: [true, 'Template type is required.'],
    enum: ['Hour', 'Day', 'Week', 'Month', 'Year', 'Never'],
    default: 'Never'
  },
  expire: {
    type: Number,
    default: 0
  },
  rules: {
    type: [taskRuleSchema],
    default: []
  },
  rule_action: {
    type: String,
    default: 'show',
    ennum: ['hide', 'show']
  },
  rule_match: {
    type: String,
    default: 'any',
    ennum: ['all', 'any']
  },
  rule_trigger_when: {
    type: String,
    default: 'submission',
    ennum: ['approval', 'submission']
  },
  /* reference_type :
    {
        type : String,
        enum: ['Survey', 'Reference'],
        default: 'Survey'
    },*/

  event: { type: Schema.Types.ObjectId, ref: 'Event' },
  survey: { type: Schema.Types.ObjectId, ref: 'Survey' },
  form: { type: Schema.Types.ObjectId, ref: 'Form' },
  reference: { type: Schema.Types.ObjectId, ref: 'Reference' },

  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Task relation role is required.']
  },
  sub_role: { type: Schema.Types.ObjectId, ref: 'SubRole' },
  assignment: {
    type: String,
    enum: ['All', 'Any', 'One'],
    default: 'Any'
  },
  url: {
    type: String
  }
}

/* taskDefaultProperties.tasks = {
        type : [ new Schema(taskDefaultProperties) ],
        default : []
};*/
