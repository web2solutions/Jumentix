#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Message Sender API

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------

As caveat, this application framework provides a built in API which can be quicly used to send messages across RabbitMQ queues.

> The `sender API` is built over the `Application object` and provides a commom way to easily send RabbitMQ messages under a wel defined contract.

***It asserts the existence of the following RabbitMQ channels***:

1. `application.config.mq.notificationQueue`

{durable: true} (see src/config/mq.js for further info)

2. `application.config.mq.clientsNotificationQueue`

{durable: true} (see src/config/mq.js for further info)

3. `application.config.mq.loggerQueue`

{durable: true} (see src/config/mq.js for further info)

4. `application.config.mq.alertNotificationQueue`

{durable: true} (see src/config/mq.js for further info)

5. `application.config.mq.mailQueue`

{durable: true} (see src/config/mq.js for further info)



## Namespace

`application.sender.send`


#### Methods


#### `application.sender.send.messageToQueue( queue, msg )`

Send a `RabbitEnvelop` message to a specific queue

***Parameters***

queue - Type String - queue name

msg - Type Object - RabbitEnvelop


#### `application.sender.send.notification( msg )`

Send a `RabbitEnvelop` message to the Ochestrator Worker Queue `(application.config.mq.notificationQueue)` about a job execution task

***Parameters***

msg - Type RabbitEnvelop



---
#### `application.sender.send.clientsNotification( msg )`

Notify clients about a job execution task by sending a `RabbitEnvelop` message to `Message Mediator Queue` `(application.config.mq.clientsNotificationQueue)`

***Parameters***

msg - Type RabbitEnvelop



---
#### `application.sender.send.log( msg )`

Sends a `RabbitEnvelop` message to the `Logging queue` `(application.config.mq.loggerQueue)`

***Parameters***

msg - Type RabbitEnvelop




---
#### `application.sender.send.alert( subject, message )`

Send admin email alerts by sending a `RabbitEnvelop` message to the queue `application.config.mq.alertNotificationQueue`

Used by the `Application Stats Service`

***Parameters***

subject - String - Email message subject

message - String - Email message body


---
#### `application.sender.send.mail( user_email, subject, message )`


Send general e-mail messages via Gmail by sending a  `RabbitEnvelop` message to the  `application.config.mq.mailQueue`

***Parameters***

user_email - String - Target email address

subject - String - Email message subject

message - String - Email message body





---
#### `application.sender.send.jobMailNotification( c )`

Notify clients about a job execution task (through Gmail messages) by sending a  `RabbitEnvelop`  message to `(self.config.mq.mailQueue)`

***Parameters***

msg - Type RabbitEnvelop






## Messaging pattern


#### Message Example - Triggering a `Call` to the `HelloWorld.action` `Remote Procedure`


```javascript
const jobRequestData = new RabbitEnvelop(
{
    "from": {
        "userId" : 444,
        "companyId" : 243,
        "user_email" : "eduardo.almeida@cairsolutions.com",
        "name": "Jose Eduardo",
        id: (new Date()).getTime()
    },
    "entity" : "HelloWorld",
    "action" : "action",
    "payload" :
    {
        "file_name" : "book.pdf",
        "blob" : " binary_data_here ",
        "some" : "some",
        "other" : "other",
        "info" : "info",
    }
})
```
