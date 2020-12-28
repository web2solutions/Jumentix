#   <img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /> Application

The Application bootstrap class is the Main class which every application based on this framework should inherits from

***Type***: `class`


[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------
## Implemented Properties

#### `application.env`

String - development, test or production


#### `application.config`

Object - holds application.config API


#### `application.port`

Number - application port in server


#### `application.logDir`

String - directory to store application logs


#### `application.logger`

Object - holds Winston logger API


#### `application.models`

Object - holds Mongo Models API


#### `application.$db`

Object - holds mongoose connection



#### `application.db`

Object - holds sequelize client API



#### `application.sender`

Object - Holds RabbitMQ sender API



#### `application.redis`

Object - holds Redis Store and Pub/Sub API


`application.redis.store`

***Type***:

Object - [redis client](https://www.npmjs.com/package/redis)



#### `application.channel`

Object - holds the RabbitMQ channel used by this application


#### `application.connection`

Object - holds RabbitMQ connection



#### `application.queueName`

String - RabbbitMQ  queue name which the application listen to



#### `application.exchangeName`

String - RabbbitMQ exchange name which this application consumes out


#### `application.routingKey`

String - routing key name used to publish messages over a RabbitMQ exchange


#### `application.channel`

Object - RabbitMQ channel object used to communicate with RabbitMQ server. Relies on application.connection



#### `application.timeOutMQReConnect`

Function - time out function to be called when reconnecting to rabbitMQ server



#### `application.rabbitmqConnectionStatus`

String - stores connection status



#### `application.probe`

Object - pmx.probe() object



#### `application.timeRamAndCpuChecking`

Number - value in seconds. default 1



#### `application.intervalRamAndCpuChecking`

Function or False - Interval Function that checks RAM memory and CPU usage



#### `application.cpu_metric`

Checks application CPU usage



#### `application.ram_metric`

Checks application RAM memory usage



--------------------------
## Implemented Methods


#### `application.consumeMessage(msg)`

Called by default when a message is income from RabbitMQ channel

Shall to be overwrited on Created Application level



#### `async application.restartProcess()`

Restarts application process



#### `async application.serviceStop()`

Stops: RabbitMQ and Redis clients
Stops: Stats service



#### `application.startConsoleService()`

Starts application.console api



#### `application.startLoggerService()`

Starts the application logger



#### `application.startStatsService()`

Starts the Application Stats Service



#### `async application.stopProcess()`

Stops application process


--------------------------
### Config API

Implements a commom way to access the application settings defined across `src/config` files

***Namespace***: `application.config`

#### `application.config.app`

Holds a copy of `src/config/index[ env ]` Configuration Object


#### `application.config.mq`


Holds a copy of `src/config/mq[ env ]` Configuration Object


#### `application.config.redis`


Holds a copy of `src/config/redis[ env ]` Configuration Object

#### `application.config.gmail`


Holds a copy of `src/config/gmail[ env ]` Configuration Object



#### `application.config.mailgun`


Holds a copy of `src/config/mailgun[ env ]` Configuration Object



--------------------------
### Metrics API

Implements a metric API to be used alongside pm2

***Namespace***: `application.metrics`

#### `application.metrics.messages.received.inc()`

Increments the messages.received value.

Called when a message is received by RabbitMQ channel.

See: `RabbitClient.js`


#### `application.metrics.messages.errored.inc()`

Increments the messages.errored value

Called when job was not sucessfuly executed.

See: `services/Job.js`


#### `application.metrics.messages.executed.inc()`

Increments the messages.executed value

Called when job was sucessfuly executed


See: `services/Job.js`






--------------------------
### Logger API

Tracks application logging via log files

***Namespace***: `application.logger`

#### `application.logger.error( msg )`

Adds a error entry to log

#### `application.logger.info( msg )`

Adds a info entry to log

#### `application.logger.warn( msg )`

Adds a warn entry to log




--------------------------
### Console API

Implements a debug api over console and logger

***Namespace***: `application.console`


#### `application.console.error( msg )`


Calls `application.logger.error( msg )` transparently



#### `application.console.info( msg )`


Calls `application.logger.info( msg )` transparently

#### `application.console.notice( msg, data )`


#### `application.console.warn( msg )`


Calls `application.logger.warn( msg )` transparently

#### `application.console.process( process )`
