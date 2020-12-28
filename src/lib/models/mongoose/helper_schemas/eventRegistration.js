import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const eventRegistrationSchema = new Schema({
  registered_date: {
    type: Date,
    required: [true, 'Registered Date is required.']
  },
  human: {
    type: Schema.Types.ObjectId,
    ref: 'Human',
    required: [true, 'Human ID is required.']
  },
  status: {
    type: String,
    enum: ['Waiting', 'Confirmed', 'Registered', 'Cancelled', 'Did Not Attend'],
    default: 'Waiting'
  },
  form: {
    type: String
    // type : Schema.Types.ObjectId,
    // ref: 'Form'
  },
  form_entry: {
    type: String
    // type : Schema.Types.ObjectId,
    // ref: 'FormEntry'
  },
  amount_paid: {
    type: Number,
    default: 0
  }
})
