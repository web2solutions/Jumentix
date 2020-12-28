'use strict'

import Service from '../Job/Service' // mandatory

/**
 * Class representing a JobLog Entity Service
 * @extends Service
 */
class JobLog extends Service {
  /**
   * Creates a JobLog Entity Service
   * @constructor
   * @param {object} application - mandatory - the application object which this service is plugged to
   */
  constructor(application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call
    /**
                Specify the Entity name which this service handles.
                The entity shall to have a specified Mongoose or Sequelize model
                The Model, The table (collection) and the data entity must ALL have the same name
            */
    this.entity = 'JobLog'
    /**
                Specify the primary key name which this service handles.
                default is _id
            */
    this.primaryKeyName = '_id'
    /**
                Specify the storage engine - memory, mongo or sequelize
                default is mongo
            */
    this.setStorageEngine('mongo') // default is mongo

    /**
            Specify this entity collection data should be cached on redis
            default is false
        */
    this.isCached = true
  }
}

export default JobLog
