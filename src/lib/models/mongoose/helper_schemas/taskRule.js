import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

// { source_collection:'Human', source_field: 'address.state', condition: 'equal', match_value: 'Michigan' },
export const taskRuleSchema = new Schema({
  entity: {
    type: String,
    required: [true, 'Source collection name is required.']
  },
  field: {
    type: String,
    required: [true, 'Source field name is required.']
  },
  condition: {
    type: String,
    required: [true, 'Condition is required.'],
    enum: ['equal', 'not equal', 'contains', 'does not contains']
  },
  match_value: {
    type: String,
    required: [true, 'Match Value is required.']
  }
})
