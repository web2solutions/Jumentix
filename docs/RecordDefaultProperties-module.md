#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Sequelize Record Default Properties

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------

RecordDefaultProperties module contains the default properties for sequelize model configuration, which are automatically added to all sequelize models defined in this application.

*Sequelize models created in this framework must include these properties.*

*How to use*:

```javascript
import RecordDefaultProperties from '../RecordDefaultProperties'
import { copy } from '../../util'

const DataEntityName = "DemoUser"

let table_layout = copy( RecordDefaultProperties( DataTypes ), {
  ...
  // other available properties of this model
}),
table_settings  = {
    // don't add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,
    // define the table's name
    tableName: DataEntityName
},

model = sequelize.define( DataEntityName, table_layout, table_settings );
```



[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------
## Available Default Properties


#### *`_writer_id`*

Id of user who created the document

*Type: INTEGER*

*Required: true*


#### *`active`*

Shows whether the document is active or not

*Type: Boolean*

*Default: true*


#### *`deleted`*

Shows whether the document is deleted or not

*Type: Boolean*

*Default: false*


#### *`_history`*

Contains logs of all the modifications made to the document

*Type: TEXT*

*Default: '[]'*


#### *`__v`*

version flag

*Type: INTEGER*

*Default: 0*
