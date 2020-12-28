import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'
import { transactionInfoSchema } from './helper_schemas/transactionInfo'
import { goodSchema } from './helper_schemas/good'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId,
  schemaSettings = null

schemaSettings = copy(DocumentDefaultProperties, {
  transaction_type: {
    type: String,
    required: [true, 'Transaction type is required.'],
    enum: ['Check', 'eCheck', 'Wire Transfer', 'Credit Card', 'Cash']
  },
  invoice: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Invoice' }],
    default: []
  },
  info: {
    type: [transactionInfoSchema],
    default: []
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required.'],
    default: 0
  },
  amount_minimum: {
    type: Number,
    required: [true, 'Minimum amount is required.'],
    default: 0
  },
  drawee: {
    type: Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Drawee ID is required.']
  },
  inquirer: {
    type: Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Inquirer ID is required.']
  },
  good: {
    type: [goodSchema],
    default: []
  },
  name: {
    type: String,
    required: [true, 'Transaction is required.']
  }
})

let TransactionSchema = new Schema(schemaSettings /* , { versionKey: false }*/)

TransactionSchema.plugin(mongoosePaginate)

TransactionSchema.virtual('id').get(function () {
  return this._id.toHexString()
})

TransactionSchema.index({ '$**': 'text' })

// Ensure virtual fields are serialised.
TransactionSchema.set('toJSON', { getters: true, virtuals: true })

TransactionSchema.method('toClient', function () {
  let obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

export const Transaction = mongoose.model('Transaction', TransactionSchema)
