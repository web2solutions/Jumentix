import mongoose from 'mongoose'

import { fileSchema } from './mongoose/helper_schemas/file'
const Schema = mongoose.Schema

const DocumentDefaultProperties = {
  // _id : ObjectId,
  // commom to all
  // date when document was created

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
    ref: 'Human',
    populate: true
  },

  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Human',
    populate: true
  },

  // active flag
  active: {
    type: Boolean,
    default: true
  },
  // delete flag
  deleted: {
    type: Boolean,
    default: false
  },

  // holds entire document change history
  /** _history: {
        type : [],
        default: [],
        select: false // hide from queries
    }, */

  file: {
    type: [fileSchema],
    default: []
  }
  // view array
}

export default DocumentDefaultProperties
