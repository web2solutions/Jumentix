import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const eventBadgeSchema = new Schema({
  category: {
    type: Schema.Types.ObjectId,
    ref: 'EventCategory',
    required: [true, 'Event Category ID is required.']
  },
  sub_category: {
    type: Schema.Types.ObjectId,
    ref: 'EventSubCategory',
    required: [true, 'Event Sub Category ID is required.']
  },
  key_code: {
    type: String,
    required: [true, 'Key Code is required.']
  },
  width: {
    type: Number,
    required: [true, 'Badge Width is required.']
  },
  height: {
    type: Number,
    required: [true, 'Badge Height is required.']
  }
})
