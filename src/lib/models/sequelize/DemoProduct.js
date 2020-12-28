'use strict'

import RecordDefaultProperties from '../RecordDefaultProperties'
import { copy } from '../../util'

const DataEntityName = 'DemoProduct'

export default function (sequelize, DataTypes) {
  let table_layout = copy(RecordDefaultProperties(DataTypes), {
      product: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false
      },
      price: {
        type: DataTypes.STRING,
        allowNull: false
      }
    }),
    table_settings = {
      // don't add the timestamp attributes (updatedAt, createdAt)
      timestamps: true,

      // don't delete database entries but set the newly added attribute deletedAt
      // to the current date (when deletion was done). paranoid will only work if
      // timestamps are enabled
      // paranoid: false,

      // don't use camelcase for automatically added attributes but underscore style
      // so updatedAt will be updated_at
      // underscored: false,

      // disable the modification of tablenames; By default, sequelize will automatically
      // transform all passed model names (first parameter of define) into plural.
      // if you don't want that, set the following
      // freezeTableName: true,

      // define the table's name
      tableName: DataEntityName
    },
    model = sequelize.define(DataEntityName, table_layout, table_settings)

  return model
}
