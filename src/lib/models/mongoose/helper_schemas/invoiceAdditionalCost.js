import mongoose from 'mongoose'

const Schema = mongoose.Schema

export const invoiceAdditionalCostSchema = new Schema({
  name: {
    type: String,
    required: [
      true, 'name is required.'
    ]
  },
  description: {
    type: String,
    required: [
      true, 'description is required.'
    ]
  },
  amount: {
    type: Number,
    required: [
      true, 'Amount is required.'
    ]
  }
})
