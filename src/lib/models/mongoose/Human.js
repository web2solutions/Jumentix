import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import is from 'is_js'
import { copy } from '../../util'
import path from 'path'
import { addressSchema } from './helper_schemas/address'
import { emailSchema } from './helper_schemas/email'
import { phoneSchema } from './helper_schemas/phone'
import { memoSchema } from './helper_schemas/memo'

const Schema = mongoose.Schema
let schemaSettings = null

// console.log('sdfsfdfdsfdsfdsfsdfdsfdsfdsf', is.any.date(new Date(), 'bar'))

schemaSettings = copy(DocumentDefaultProperties, {
  user: { type: Schema.Types.ObjectId, ref: 'User', populate: true },

  // ---------
  first_name: {
    type: String,
    required: [true, 'First name is required.']
  },
  last_name: {
    type: String,
    required: [true, 'Last name is required.']
  },
  nationality: {
    type: String,
    default: 'United States of America'
    /** required : [
            true, 'Nationality is required.'
        ] */
  },
  email: {
    type: [emailSchema],
    default: []
  },
  address: {
    type: [addressSchema],
    default: []
  },
  phone: {
    type: [phoneSchema],
    default: []
  },
  gender: {
    type: String,
    // required: [true, 'Gender is required.'],
    default: 'Unknown',
    enum: [
      'Male',
      'Female',
      'Female to Male',
      'Male to Female',
      'In Transition',
      'Other',
      'Unknown'
    ]
  },
  sexual_orientation: {
    type: String,
    // required: [true, 'Sexual Orientation is required.'],
    // need review
    default: 'Unknown',
    enum: [
      'Male',
      'Female',
      'Heterosexual/Straight',
      'Gay/Lesbian',
      'Other',
      'Prefer Not to Answer',
      'Unknown'
    ]
  },
  // { data: Buffer, contentType: String }
  photo: {
    type: String,
    default: '/static/avatar.png'
  },

  birthDate: Date,
  deathDate: Date,
  ssn: {
    type: String,
    // required: [true, 'SSN is required.'],
    // unique: true,
    validate: {
      validator: function (v) {
        if (v === '') {
          return true
        }
        return is.socialSecurityNumber(v)
      },
      message: (props) => `${props.value} is not a valid ssn number!`
    }
    // is.socialSecurityNumber
  },
  memo: {
    type: [memoSchema],
    default: []
  }
})

const HumanSchema = new Schema(
  schemaSettings,
  { strict: false } /* , { versionKey: false } */
)

HumanSchema.virtual('id').get(function () {
  return this._id.toHexString()
})

HumanSchema.virtual('name').get(function () {
  return this.first_name + ' ' + this.last_name
})

/** HumanSchema.index({
    last_name: 'text',
    first_name: 'text',
    gender: 'text',
    sexual_orientation: 'text',
    ssn: 'text',
}); */

HumanSchema.index({ '$**': 'text' })

// Ensure virtual fields are serialised.
HumanSchema.set('toJSON', { getters: true, virtuals: true })

HumanSchema.method('toClient', function () {
  const obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

// require(path.normalize(`${__dirname}`) + '/hooks/Human.js').default(HumanSchema)
// require(path.normalize(`${__dirname}`) + '/statics/Human.js').default(HumanSchema)
// require(path.normalize(`${__dirname}`) + '/methods/Human.js').default(HumanSchema)

//

HumanSchema.plugin(mongoosePaginate)

export const Human = mongoose.model('Human', HumanSchema)
