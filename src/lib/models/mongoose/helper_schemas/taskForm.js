import mongoose from 'mongoose'
import { taskFormAssignedToSchema } from './taskFormAssignedTo'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const taskFormSchema = new Schema({
  form: {
    type: Schema.Types.ObjectId,
    ref: 'Form',
    required: [true, 'Form ID is required.']
  },
  assigned_to: {
    type: [taskFormAssignedToSchema],
    default: []
  }
})
