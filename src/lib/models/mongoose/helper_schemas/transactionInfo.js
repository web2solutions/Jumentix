import mongoose from 'mongoose'
import { transactionInfoSignatureSchema } from './transactionInfoSignature'
import { addressSchema } from './address'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const transactionInfoSchema = new Schema({
  name: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return [isRequired, 'Name is required']
    }
  },
  amount_minimum: {
    type: Number,
    required: function () {
      let isRequired = this.type === 'Check'
      return [isRequired, 'Minimun amount is required']
    }
  },
  amount_paid: {
    type: Number,
    required: [true, 'The paid amount is required']
  },
  type: {
    type: String,
    required: [true, 'Transaction info type is required'],
    enum: ['Check', 'eCheck', 'Wire Transfer', 'Credit Card', 'Cash']
  },
  check_number: {
    type: Number,
    required: function () {
      let isRequired = this.type === 'Check' || this.type === 'eCheck'
      return [isRequired, 'Check number is required']
    }
  },
  account_number: {
    type: Number,
    required: function () {
      let isRequired =
        this.type === 'Check' ||
        this.type === 'eCheck' ||
        this.type === 'Wire Transfer'
      return isRequired
    }
  },
  aba_number: {
    type: Number,
    required: function () {
      let isRequired =
        this.type === 'Check' ||
        this.type === 'eCheck' ||
        this.type === 'Wire Transfer'
      return isRequired
    }
  },
  bank_name: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Wire Transfer'
      return isRequired
    }
  },
  signature: {
    type: Schema.Types.ObjectId,
    ref: 'Signature'
  },
  transaction_number: {
    type: String,
    required: function () {
      let isRequired =
        this.type === 'Wire Transfer' || this.type === 'Credit Card'
      return isRequired
    }
  },
  credit_card_processor: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return isRequired
    }
  },
  credit_card_vendor: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return isRequired
    }
  },
  return_status: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return isRequired
    }
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: new Date().getTime()
  },
  address: {
    type: [addressSchema],
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return isRequired
    },
    default: []
  }
})
