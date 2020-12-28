import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'
import { factorSchema } from './helper_schemas/factor'

const Schema = mongoose.Schema
const ObjectId = Schema.ObjectId
let schemaSettings = null

// copy createdAt, updatedAt, createdBy, updatedBy, _history
schemaSettings = copy(DocumentDefaultProperties, {
  name: {
    type: String,
    required: [true, 'Good name is required.']
  },
  type: {
    type: String,
    required: [true, 'type is required.'],
    enum: ['Product', 'Service']
  },
  /** class :
    { // type of item
        type : String,
        required : [
            true, 'class is required.'
        ]
    },
    factor :
    {
        type : [ factorSchema ],
        default : [ ]
    },
    amount :
    {
        type : Number,
        required : [
            true, 'Amount is required.'
        ]
    }, */
  unity: {
    type: String,
    required: [true, 'Unity is required.'],
    default: 'Unity',
    enum: ['Unity', 'Days', 'Hours', 'Milestone']
  },
  quantity: {
    type: Number,
    required: [true, 'quantity is required.'],
    default: 0
  },
  unityCost: {
    type: Number,
    // required : [
    //    true, 'Unity cost is required.'
    // ],
    default: 0
  },
  unityPrice: {
    type: Number,
    // required : [
    //    true, 'Unity price is required.'
    // ],
    default: 0
  },

  discount: {
    type: Number,
    // required : [
    //    true, 'Unity price is required.'
    // ],
    default: 0
  }

  // category : { type: Schema.Types.ObjectId, ref: 'FinanceCategory' },
  // sub_category : { type: Schema.Types.ObjectId, ref: 'FinanceSubCategory' }
})

const schema = new Schema(schemaSettings /* , { versionKey: false } */)

schema.plugin(mongoosePaginate)

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

schema.index({ '$**': 'text' })

// Ensure virtual fields are serialised.
schema.set('toJSON', { getters: true, virtuals: true })

schema.method('toClient', function () {
  const obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

export const Good = mongoose.model('Good', schema)
