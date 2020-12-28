import mongoose from 'mongoose'
import { taskDefaultProperties } from './taskDefaultProperties'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const taskSchema = new Schema(taskDefaultProperties)
