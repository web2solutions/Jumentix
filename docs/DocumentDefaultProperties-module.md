#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Mongoose Document Default Properties

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------

DocumentDefaultProperties module contains the default properties for mongoose schema, which are automatically added to mongoose models defined in this application.

*Models created in this framework must include these properties.*

*How to use*:

```javascript
import DocumentDefaultProperties from '../DocumentDefaultProperties'
import { copy } from '../../util'

let schemaSettings = copy( DocumentDefaultProperties, {
  ...
  // other available properties of this model
})

let DemoClientSchema = new Schema( schemaSettings /*, { versionKey: false }*/ );
```



[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------
## Available Default Properties


#### *`createdAt`*

Timestamp at which the document is created

*Type: Date*

*Default: Date.now*


#### *`updatedAt`*

Timestamp at which the document is last modified

*Type: Date*

*Default: Date.now*


#### *`_writer_id`*

Id of user who created the document

*Type: String*

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

*Type: Array*

*Default: []*
