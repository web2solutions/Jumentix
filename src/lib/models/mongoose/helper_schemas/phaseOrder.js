import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const task_groupOrderSchema = new Schema({
  task_group: {
    type: Schema.Types.ObjectId,
    ref: 'TaskGroup',
    required: [true, 'TaskGroup is required.']
  },
  order: {
    type: Number,
    required: [true, 'Order is required.'],
    default: 0
  }
})
