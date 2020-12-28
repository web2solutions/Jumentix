'use strict'

import DataAPI from './DataAPI'
import MongooseAPI from './MongooseAPI'
import SequelizeAPI from './SequelizeAPI'

/**
 * Entry interface to handle CRUD database operations over Mongoose, Sequelize and Memory
 * @class
 */
class CRUD extends MongooseAPI(SequelizeAPI(DataAPI)) {
  /**
   * Creates CRUD Service interface
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor(application) {
    super(application)
  }
}

export default CRUD
