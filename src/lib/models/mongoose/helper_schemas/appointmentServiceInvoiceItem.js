import mongoose from 'mongoose'
// import { memoSchema } from './memo'
// import { fileSchema } from './file'
import is from 'is_js'
const Schema = mongoose.Schema

export const appointmentServiceInvoiceItemSchema = new Schema({
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: Date.now
  },
  unity: {
    type: String,
    required: [true, 'Unity is required.'],
    default: 'Hour',
    enum: ['Day', 'Hour']
  },
  duration: {
    type: Number,
    // required: [true, 'quantity is required.'],
    default: 1,
    validate: {
      validator: function (v) {
        if (is.not.number(v)) {
          return false
        }
        return v > 0.5
      },
      message: (props) => `${props.value} must be a number greater than 0.5!`
    }
  },
  unityPrice: {
    type: Number,
    // required : [
    //    true, 'Unity price is required.'
    // ],
    default: 0,
    validate: {
      validator: function (v) {
        return is.number(v)
      },
      message: (props) => `${props.value} is not a valid number!`
    }
  },
  /* file: {
    type: [fileSchema],
    default: []
  },
  memo: {
    type: [memoSchema],
    default: []
  }, */
  createdAt: {
    type: Date,
    default: Date.now
  },
  // date when document was updated
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Human'
  }
})
