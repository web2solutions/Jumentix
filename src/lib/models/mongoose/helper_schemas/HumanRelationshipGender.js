import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const HumanRelationshipGenderSchema = new Schema({
  male: {
    type: {
      name: {
        type: String,
        required: [true, 'Name for Male Human Relationship Type is required.']
      },
      label: {
        type: String,
        required: [true, 'Label for Male Human Relationship Type is required.']
      }
    }
  },
  female: {
    type: {
      name: {
        type: String,
        required: [true, 'Name for Male Human Relationship Type is required.']
      },
      label: {
        type: String,
        required: [true, 'Label for Male Human Relationship Type is required.']
      }
    }
  }
})
