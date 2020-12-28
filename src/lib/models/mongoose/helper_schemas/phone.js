import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const phoneSchema = new Schema({
  type: {
    type: String,
    required: [true, 'type is required.'],
    enum: ['Home', 'Work', 'Vacation', 'Fax']
  },
  country_code: {
    type: String,
    required: [true, 'country code is required.'],
    default: '+1'
  },
  area_number: {
    type: String,
    required: [true, 'area number is required.']
  },
  number: {
    type: String,
    default: '',
    required: [true, 'phone  number is required.']
  },
  isDefault: {
    type: Boolean,
    default: false
  }
})
