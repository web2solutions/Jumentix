import mongoose from 'mongoose'
import mongoosePaginate from 'mongoose-paginate'
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import is from 'is_js'

const Schema = mongoose.Schema

const schemaSettings = {
  fornecedor: { type: Schema.Types.ObjectId, ref: 'Fornecedor', populate: true },
  nome: {
    type: String,
    required: [true, 'Nome is required.'],
    unique: true
  },
  descricao: String,
  preco: {
    type: Number,
    default: 0,
    validate: {
      validator: function (v) {
        if (is.not.number(v)) {
          return false
        }
        return v >= 0
      },
      message: (props) => `${props.value} estoque deve ser númerico maior igual a zero!`
    }
  },
  estoque: {
    type: Number,
    default: 0,
    validate: {
      validator: function (v) {
        if (is.not.number(v)) {
          return false
        }
        return v >= 0
      },
      message: (props) => `${props.value} estoque deve ser númerico maior igual a zero!`
    }
  },
  ...DocumentDefaultProperties
}

const ProdutoSchema = new Schema(
  schemaSettings, {
    strict: false
  } /* , { versionKey: false } */
)

ProdutoSchema.virtual('id').get(function () {
  return this._id.toHexString()
})

ProdutoSchema.index({
  '$**': 'text'
})

// Ensure virtual fields are serialised.
ProdutoSchema.set('toJSON', {
  getters: true,
  virtuals: true
})

ProdutoSchema.method('toClient', function () {
  const obj = this.toObject()
  // Rename fields
  obj.id = obj._id
  delete obj._id
  return obj
})

// require(path.normalize(`${__dirname}`) + '/hooks/Produto.js').default(ProdutoSchema)
// require(path.normalize(`${__dirname}`) + '/statics/Produto.js').default(ProdutoSchema)
// require(path.normalize(`${__dirname}`) + '/methods/Produto.js').default(ProdutoSchema)

ProdutoSchema.plugin(mongoosePaginate)

export const Produto = mongoose.model('Produto', ProdutoSchema)
