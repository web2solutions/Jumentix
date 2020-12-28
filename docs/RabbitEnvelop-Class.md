#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> RabbitEnvelop Class

The RabbitEnvelop classe provide a commom way to compose RabbitMQ messages (common know as Job Resource)

All messages sent to any RabbitMQ queue shall to be composed by this class constructor


[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)


--------------------------
## Implemented method

#### *`constructor`*

***Parameters:***

- *`envelop`*

Object - mandatory - holds envelop settings properties

- *`envelop.entity`*

String - Mandatory - Data Entity name which this message targets to

- *`envelop.action`*

String - Mandatory - Action/Remote Procedure name which this message targets to

- *`envelop.from`*

Object - Mandatory - A valid `Mediator User` object

- *`envelop.to`*

Object - Not Mandatory - A valid `Mediator User` object

Default: *`envelop.from`*

- *`envelop.uuid`*

String - Not Mandatory - Unique identifier string for this message (if it is a existing one)

Default: *`util.uuid()`*


- *`envelop.createdAt`*

Date - Not Mandatory - Date when the message was created

Default: Date now


- *`envelop.updatedAt`*


Date - Not Mandatory - Date when the message was updated

Default: Date now


- *`envelop.payload`*

Object - Not Mandatory - Payload data to be executed as Job

- *`envelop.data`*

Object - Not Mandatory - Is the final handled server resource object.


- *`envelop.success`*

Boolean - Not Mandatory - Indicates job success status.

Default: *`false`*


- *`envelop.error`*

Boolean / String - Not Mandatory - Job error

Default: *`false`*


- *`envelop.status`*

String - Not Mandatory - Job human friendly status

Default: *`awaiting`*


- *`envelop.message`*

String - Not Mandatory - Message content body

Default: *`'New message from ' + envelop.from.name`*


- *`envelop.subject`*

String - Not Mandatory - Message subject

Default: *`'New message from ' + envelop.from.name`*


## Examples:

```javascript
let gmail_email_task = new RabbitEnvelop( {
    "from": self.getServerUser(),
    "payload": {
        "to": pkg.author.email + ", " + pkg.contributors.map(function(user) {
            return user.email;
        }).join(", "),  // email list separated by comma
        "subject": subject,
        "message": message
    },
    "entity": "Gmail",
    "action": "send"
} )
```



```javascript
function sendNotification ( job, data, isJobDone, err)
{
    data = data || false;
    err = err || false;
    let notification_task = new RabbitEnvelop( {
        "uuid": job.uuid,
        "from": job.from,
        "payload": job.payload,
        "entity":  job.entity,
        "action":  job.action,
        "data": data,
        "success": isJobDone,
        "error": err,
        "status": isJobDone ? "done" : "not done"
    } )
    this.application.sender.send.notification( notification_task )
}
```
