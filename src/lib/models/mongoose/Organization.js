import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import {
  copy
} from '../../util'
import path from 'path'
import {
  addressSchema
} from './helper_schemas/address'
import {
  phoneSchema
} from './helper_schemas/phone'
import {
  emailSchema
} from './helper_schemas/email'
import {
  organizationHumanRelationSchema
} from './helper_schemas/organizationHumanRelation'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId,
  schemaSettings = null
// copy createdAt, updatedAt, createdBy, updatedBy, _history

schemaSettings = copy(DocumentDefaultProperties, {
  // ---------
  name: {
    type: String,
    required: [true, 'Org Name is required.']
  },
  /* type :
    {
        type : String,
        required : [
            true, 'Org type is required.'
        ]
    }, */
  feid_number: String,
  referral_source: String,
  license_number: String,
  license_expire_date: Date,
  services: {
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required.']
    }],
    default: []
  },
  human: {
    type: [organizationHumanRelationSchema],
    default: [],
    set: function (value) {
      this._previousHuman = this.human
      return value
    }
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
  system_owner: {
    type: Boolean,
    required: [true, 'Org system_owner boolean is required.'],
    default: false
  }
})

let schema = new Schema(schemaSettings /* , { versionKey: false }*/ )

schema.virtual('id').get(function () {
  return this._id.toHexString()
})

schema.index({
  '$**': 'text'
})

// Ensure virtual fields are serialised.
schema.set('toJSON', {
  getters: true,
  virtuals: true
})

schema.method('toClient', function () {
  let obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

/* require(path.normalize(`${__dirname}`) + '/hooks/Organization.js').default(
  schema
) */
// require(path.normalize(`${__dirname}`) + '/statics/Organization.js').default(schema);
// require(path.normalize(`${__dirname}`) + '/methods/Organization.js').default(schema);

schema.plugin(mongoosePaginate)

export const Organization = mongoose.model('Organization', schema)
