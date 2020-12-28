import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const goodSchema = new Schema({
  good: {
    type: Schema.Types.ObjectId,
    ref: 'Good',
    required: [true, 'Good is required.']
  },
  type: {
    type: String,
    required: [true, 'type is required.'],
    enum: ['Product', 'Service']
  },
  unity: {
    type: String,
    required: [true, 'Unity is required.'],
    default: 'Unity',
    enum: ['Unity', 'Days', 'Hours', 'Milestone']
  },
  unityPrice: {
    type: Number,
    // required : [
    //    true, 'Unity price is required.'
    // ],
    default: 0
  },
  quantity: {
    type: Number,
    required: [true, 'quantity is required.'],
    default: 0
  }
})
