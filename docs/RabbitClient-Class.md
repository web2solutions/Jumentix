#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Rabbit Client Class

The RabbitClient class provide support for RabbitMQ usage into the application.

*Applications created using this framework must inherits this class.*

*Type*: mixin class without constructor

*Example*:

```javascript
class MyNewApplication extends RabbitClient( Application )
{

}
```



[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)


## Dependency

- [amqplib/callback_api](https://www.npmjs.com/package/amqplib)

NPM RabbitMQ Library

- [RabbitEnvelop](./RabbitEnvelop-Class.md)

Provides a interface to compose strong defined contract messages to be sent over RabbitMQ queues.


--------------------------
## Implemented Methods


#### `async application.startMQ()`

Starts RabbitMQ client layer

Setup RabbitMQ related application properties.

***Notes***:

Must be the first method called on this stack.

Call once.

***Implicity called metods***:

Call application.connectMQ()

Call application.mountSendAPI()


---
#### `application.setConnectionStatus( status )`

Sets the value of `application.rabbitmqConnectionStatus` property

***Parameter***

String - status string



---
#### `application.getConnectionStatus( )`

Gets the value of `application.rabbitmqConnectionStatus` property


---
#### `async application.connectMQ()`

Connect to RabbitMQ Box and create a channel and it associated resources


---
#### `async application.reconnectMQ()`

Reconnect to RabbitMQ Box



---
#### `async application.stopMQ()`

Stops timeOutMQReConnect.

Closes the application channel

Closes the RabbitMQ connection



---
#### `application.mountSendAPI()`

Setup the `sender API`

The `sender API` provides a commom way to easily send RabbitMQ messages under a wel defined contract

***It asserts the following channels***:

1. `application.config.mq.notificationQueue`, {durable: true}

2. `application.config.mq.clientsNotificationQueue`, {durable: true}

3. `application.config.mq.loggerQueue`, {durable: true}

4. `application.config.mq.alertNotificationQueue`, {durable: true}

5. `application.config.mq.mailQueue`, {durable: true}


---
#### `application.getServerUser()`

Gets a fake user representing this server application


-----------------------------

## Sender API

***Namespace***: `application.sender.send`


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
