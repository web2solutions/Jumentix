import mongoose from 'mongoose'
import { transactionInfoSignatureSchema } from './transactionInfoSignature'
import { addressSchema } from './address'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const transactionInfoSchema = new Schema({
  type: {
    type: String,
    required: [true, 'Transaction info type is required'],
    enum: ['Check', 'E-Check', 'Wire Transfer', 'Credit Card', 'Cash']
  },
  check_number: {
    type: Number,
    required: function () {
      let isRequired = this.type === 'Check' || this.type === 'E-Check'
      return [isRequired, 'Check number is required']
    }
  },
  account_number: {
    type: Number,
    required: function () {
      let isRequired =
        this.type === 'Check' ||
        this.type === 'E-Check' ||
        this.type === 'Wire Transfer'
      return [isRequired, 'Account number is required']
    }
  },
  aba_number: {
    type: Number,
    required: function () {
      let isRequired =
        this.type === 'Check' ||
        this.type === 'E-Check' ||
        this.type === 'Wire Transfer'
      return [isRequired, 'ABA number is required']
    }
  },
  amount_paid: {
    type: Number,
    required: [true, 'The paid amount is required']
  },
  amount_minimum: {
    type: Number,
    required: function () {
      let isRequired = this.type === 'Check'
      return [isRequired, 'Minimun amount is required']
    }
  },
  bank_name: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Wire Transfer'
      return [isRequired, 'Bank name is required']
    }
  },
  signature: {
    type: Schema.Types.ObjectId,
    ref: 'Signature',
    default: ''
  },
  transaction_number: {
    type: String,
    required: function () {
      let isRequired =
        this.type === 'Wire Transfer' || this.type === 'Credit Card'
      return [isRequired, 'Transaction number is required']
    }
  },
  credit_card_processor: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return [isRequired, 'Credit card processor is required']
    }
  },
  credit_card_vendor: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return [isRequired, 'Credit card vendor is required']
    }
  },
  return_status: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return [isRequired, 'Return stats is required']
    }
  },
  address: {
    type: [addressSchema],
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return [isRequired, 'Billing Address is required']
    },
    default: []
  },
  name: {
    type: String,
    required: function () {
      let isRequired = this.type === 'Credit Card'
      return [isRequired, 'Name is required']
    }
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: new Date().getTime()
  }
})
