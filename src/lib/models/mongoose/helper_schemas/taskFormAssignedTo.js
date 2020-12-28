import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const taskFormAssignedToSchema = new Schema({
  human: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  task_relation: {
    type: Schema.Types.ObjectId,
    ref: 'TaskRelation'
  }
})
