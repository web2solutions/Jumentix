import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const emailSchema = new Schema({
  type: {
    type: String,
    required: [true, 'type is required.'],
    enum: ['Home', 'Work', 'Vacation', 'Billing'],
    default: 'Home'
  },
  email: {
    type: String,
    required: [true, 'e-mail address is required.']
  },
  isDefault: {
    type: Boolean,
    default: false
  }
})
