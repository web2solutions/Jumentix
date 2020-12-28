module.exports = {
  fields: {
    id: {
      type: 'uuid',
      default: {
        $db_function: 'uuid()'
      }
    },
    user: {
      type: 'text',
      required: [true, 'user is required.']
    },
    date: {
      type: 'timestamp',
      default: { $db_function: 'toTimestamp(now())' }
    },
    device: {
      type: 'text',
      default: ''
    },
    os: {
      type: 'text',
      default: ''
    },
    session_id: {
      type: 'text',
      default: ''
    },
    browser: {
      type: 'text',
      default: ''
    },
    user_agent: {
      type: 'text',
      default: ''
    },
    ip: {
      type: 'text',
      default: ''
    },
    country: {
      type: 'text',
      default: ''
    },
    state: {
      type: 'text',
      default: ''
    },
    city: {
      type: 'text',
      default: ''
    },
    geolocation: {
      type: 'text',
      default: ''
    }
  },
  key: [['id'], 'date'],
  clustering_order: { date: 'desc' },
  indexes: ['user']
}
