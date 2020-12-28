module.exports = {
  fields: {
    id: {
      type: 'uuid',
      default: {
        $db_function: 'uuid()'
      }
    },
    entity: {
      type: 'text',
      required: [true, 'Read list is required.']
    },
    document_id: {
      type: 'text',
      required: [true, 'document_id is required.']
    },
    updatedBy: {
      type: 'text',
      required: [true, 'document_id is required.']
    },
    version: {
      type: 'int',
      default: 0
    },
    document: {
      // type: 'map',
      // typeDef: '<text, varchar>'
      type: 'text'
    }
  },
  key: ['id']
}
