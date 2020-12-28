import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import is from 'is_js'

const Schema = mongoose.Schema

const schemaSettings = {
  logo: {
    type: String,
    default: '/static/avatar.png'
  },
  nome: {
    type: String,
    required: [true, 'Nome is required.'],
    unique: true
  },
  descricao: String,
  ...DocumentDefaultProperties
}

const FornecedorSchema = new Schema(
  schemaSettings, {
    strict: false
  } /* , { versionKey: false } */
)

FornecedorSchema.virtual('id').get(function () {
  return this._id.toHexString()
})

FornecedorSchema.index({
  '$**': 'text'
})

// Ensure virtual fields are serialised.
FornecedorSchema.set('toJSON', {
  getters: true,
  virtuals: true
})

FornecedorSchema.method('toClient', function () {
  const obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

// require(path.normalize(`${__dirname}`) + '/hooks/Fornecedor.js').default(FornecedorSchema)
// require(path.normalize(`${__dirname}`) + '/statics/Fornecedor.js').default(FornecedorSchema)
// require(path.normalize(`${__dirname}`) + '/methods/Fornecedor.js').default(FornecedorSchema)

FornecedorSchema.plugin(mongoosePaginate)

export const Fornecedor = mongoose.model('Fornecedor', FornecedorSchema)
