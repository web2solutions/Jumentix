#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Model layers

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------


A `Model Layer` is nothing more than a `Schema` defining how a `Data Entity` document (NoSQL) or record (SQL) behaves.

On modern applications, you don't use raw data queries, rather than, you do handle models.

It defines things like:

- Property names
- Data types
- Validation
- Public and Static methods

The way you are gonna define your `Data Entity Model` will depends in which Storagr Engine you are going to use to handle the specified `Data Entity`

- [See Mongoose documentation](https://mongoosejs.com/docs/models.html) for Mongo based models


- [See Sequelize documentation](http://docs.sequelizejs.com/manual/tutorial/models-definition.html) for SQL based models


## How to create a Mongoose Model


Please check the `DemoUser` example related files at `./models/mongoose/DemoUser.js`.



### Putting in practice

1. Create the specified model file under `./models/mongoose`.

    1.1. Inherits default Mongoose properties.



### DemoUser Mongoose model example

```javascript
/**
    import mongoose module
*/
import mongoose from 'mongoose'
/**
    import mongoose paginate module
*/
import mongoosePaginate from 'mongoose-paginate'
/**
    import default document properties to be used in this model
*/
import DocumentDefaultProperties from '../DocumentDefaultProperties'
/**
    import copy function to copy objects
*/
import { copy } from '../../util'

let Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    schemaSettings = null;


/**
    set Schema settings.
    Copy default properties also
*/
schemaSettings = copy( DocumentDefaultProperties, {
    first_name :
    {
        type : String,
        required : [true, 'first_name is required.']
    }
    ,last_name :
    {
        type : String,
        required : [true, 'last_name is required.']
    },
    email :
    {
        type : String,
        required : [true, 'email is required.']
    }
})

/**
    create a Mongoose Schema
*/
let schema = new Schema( schemaSettings /*, { versionKey: false }*/ );

schema.plugin(mongoosePaginate);

schema.virtual('id').get(function()
{
    return this._id.toHexString();
});

// Ensure virtual fields are serialised.
schema.set('toJSON', { getters: true, virtuals: true });

schema.method('toClient', function()
{
    let obj = this.toObject();
    //Rename fields
    obj.id = obj._id;
    delete obj._id;
    return obj;
});

/**
    export DemoUser model - (this is the name of your collection)
*/
export const DemoUser = mongoose.model('DemoUser', schema);

```





--------------------------


## How to create a Sequelize Model


Please check the `DemoUser` example related files at `./models/sequelize/DemoUser.js`.



### Putting in practice

1. Create the specified model file under `./models/sequelize`.

    1.1. Inherits default sequelize record properties.



### DemoUser Sequelize model example

```javascript
"use strict";
/**
    import Record default properties objects
*/
import RecordDefaultProperties from '../RecordDefaultProperties'
/**
    import copy function to copy objects
*/
import { copy } from '../../util'

/**
    set Data entity name - this is the name of your table
*/
const DataEntityName = "DemoUser"

export default function( sequelize, DataTypes )
{
    let table_layout = copy( RecordDefaultProperties( DataTypes ),
        {
            first_name: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: {
                      msg: "Must not be empty"
                    },
                }
            },
            last_name: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: {
                      msg: "Must not be empty"
                    },
                }
            },
            email: {
                type: DataTypes.STRING,
                allowNull: false,
                //unique: true,
                validate: {
                    isEmail: {
                      msg: "Must be a valid e-mail address"
                    },
                    notEmpty: {
                      msg: "Must not be empty"
                    },
                }
            }
        }),
        table_settings  = {
          // don't add the timestamp attributes (updatedAt, createdAt)
          timestamps: true,

          // don't delete database entries but set the newly added attribute deletedAt
          // to the current date (when deletion was done). paranoid will only work if
          // timestamps are enabled
          //paranoid: false,

          // don't use camelcase for automatically added attributes but underscore style
          // so updatedAt will be updated_at
          //underscored: false,

          // disable the modification of tablenames; By default, sequelize will automatically
          // transform all passed model names (first parameter of define) into plural.
          // if you don't want that, set the following
          //freezeTableName: true,

          // define the table's name
          tableName: DataEntityName
      },
      model = sequelize.define( DataEntityName, table_layout, table_settings );

    return model
}

```
