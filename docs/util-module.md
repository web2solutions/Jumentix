#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Util module

The util module provide commom functions to be used in the entire framework and it based applications



[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)


--------------------------
## Implemented functions

#### *`validName(nickname)`*

Check if string is a valid nick name.

Returns Boolean

***Parameters:***

*`nickname`* - string - mandatory




#### *`copy(obj, targetObj)`*

Copy a entire JS object into another one.

Returns Object

***Parameters:***

*`obj`*

Object - mandatory

Object which you are copying properties from

*`targetObj`*

Object - not mandatory - default {}

Object which you are copying properties to







#### *`findIndex(arr, el)`*

Find the index position of an item on a array

***Parameters:***

*`arr`*

Array - mandatory

Object which you are copying properties from

*`el`*

Any type - mandatory

element from the array what you want to get the index of




#### *`sanitizeString(message)`*

Sanitize a message

Returns String

***Parameters:***

*`message`*

String - mandatory


#### *`uuid()`*

Generates a Universally unique identifier

Returns String


#### *`isDefined(variable)`*

Check if a variable is defined

Returns Boolean

***Parameters:***

*`variable`* - Any type - mandatory


#### *`isNumber(n)`*

Check if a variable is a number

Returns Boolean

***Parameters:***

*`n`* - Any type - mandatory


#### *`isArray(n)`*

Check if a variable is an array

Returns Boolean

***Parameters:***

*`n`* - Any type - mandatory


#### *`isEmail(email)`*

Check if a variable is an e-mail address

Returns Boolean

***Parameters:***

*`email`* - String - mandatory


#### *`isObject(val)`*

Check if a variable is an object

Returns Boolean

***Parameters:***

*`val`* - Any type - mandatory


#### *`isDate( dt )`*

Check if a variable is a date

Returns Boolean

***Parameters:***

*`dt`* - Any type - mandatory


#### *`comparer(a, b)`*

Compare two variables

Returns `1` if `a` greater than `b`, `0` if `a` equals to `b`, else return `-1`

***Parameters:***

*`a`*

Number - mandatory

First number to compare

*`b`*

Number - mandatory

Second number to compare


#### *`getPersonalRoomName(userId, companyId)`*

Get a user Room Name String based on it userId and companyId

Returns String

***Parameters:***

*`userId`* - Integer - mandatory

*`companyId`* - Integer - mandatory


#### *`getValidatedResource(payload, params)`*

Read a Job payload and get only allowed properties (allowed properties are the same defined in swagger)

Returns Object

Object with only allowded properties and values

***Parameters:***

*`payload`*

Object - mandatory

Object with all the properties and values

*`params`*

Array - mandatory

Array of allowded properties


#### *`validateJob(job)`*

Validates a job request

Returns Boolean

***Parameters:***

*`job`* - Object - mandatory


#### *`emailPayload(payload)`*

Check if it is a e-mail payload

Returns Boolean

***Parameters:***

*`payload`* - Object - mandatory


#### *`mailOptions(from, to, subject, message, files)`*

get a universal `NodeMailer` `mailOptions object`

Returns Object

***Parameters:***

*`from`*

String - mandatory

From email address

*`to`*

String - mandatory

To email address

*`subject`*

String - mandatory

Subject of email

*`message`*

String - mandatory

Body of email

*`files`*

Array of Strings - not mandatory - default []

Array of attachments file path


#### *`formatMessage(job, data)`*

Format job information as HTML to be sent as mail message

Returns String

String contains the html content to be sent as mail

***Parameters:***

*`job`*

Object - mandatory

Object which contains the job details

*`data`*

Object - not mandatory - default {}


#### *`encodeString(str)`*

Safe encode strings

Returns String

***Parameters:***

*`str`*

String - mandatory

String to be encoded


#### *`decodeString(str)`*

Safe decode strings

Returns String

***Parameters:***

*`str`*

String - mandatory

Encoded string


#### *`composeMessageAlert(message, os)`*

Compose alert messages to be sent out as e-mail message by the appplication monitoring piece

Returns String

***Parameters:***

*`message`*

String - not mandatory - default ''

*`message`*

Object - mandatory

os information


#### *`getStatsAsobject(os)`*

Compose os information as JSON object

Returns Object

***Parameters:***

*`os`* - Object - mandatory

os information
