import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const transactionInfoSignatureSchema = new Schema({
  signature: {
    type: String,
    required: [true, 'Signature is required']
  },
  name: {
    type: String,
    required: [true, 'Signature name is required']
  },
  creation_date: {
    type: Date,
    required: [true, 'Creation date is required'],
    default: new Date().getTime()
  }
})
