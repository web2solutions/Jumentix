import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const programRoleSchema = new Schema({
  role: {
    type: Schema.Types.ObjectId,
    ref: 'Role'
  },
  sub_roles: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubRole'
      }
    ],
    default: []
  }
})
