#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> RPCMapper Class

The `RPCMapper` class ***maps*** `RabbitEnvelop messages` to a specific `Data Entity Service layer` and a specific `Service layer action`

It can be used inside a `channel consumer function` from a `Worker`, or inside `REST HTTP controller` from an `API` to execute a `Data Entity Service` ***`action`***.

Those actions may be `database` related: `Create`, `Update`, `Delete`, `List one`, `List all`  records.

Not least, those actions may be `fyle system` related: `Upload`, `Copy`, `Move`, `Read`, `Edit`, `Delete` files.

As we were discussion prior, `sending` and `receiving` `messages`, is the way which `Micro Services` `talk` to each other.

The problem is that we have 2 underlying message protocols being handled here: `HTTP (APIs)` and `AMQP (workers)` ***messages***

Then to solve above problem, we use the RabbitEnvelop class, which implements a `Message Contract` that will be used as `standard format` to `send` and `receive` `Micro Service` messages.



[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)


--------------------------
## Using inside a REST HTTP controller

When a `browser` makes a `HTTP request (ajax)` to a `REST end point`, it is sending a `HTTP message` to a specific `REST HTTP controller`.

This is how HTTP protocol works. Based on messages.

The `REST HTTP controller` then receives the `HTTP message` over a specific `HTTP Method` (GET, POST, PUT, DEL, PATCH) implementation.

The received `HTTP message` is a combination of `Message Headers` and `Message Body` information.

Then based on that information, the  `REST HTTP controller` execute a specific action on server.



> Lets conside the following `src/lib/api/controllers/DemoUser.js` controller file example:


#### `DemoUser` `controller`

```javascript
/**
    import REST response function
*/
import { result, notFound, errorResponse, accepted, created } from '../../response';
/**
    Import RabbitEnvelop message composer class
*/
import RabbitEnvelop from '../../RabbitEnvelop'
/**
    Import application running instance to be able to use it RPC Mapper
*/
import app from '../../../app'

const
    entity = "DemoUser",
    queue = `JumentiX.${entity}`,
    primaryKeyName = '_id';



/**
    HTTP Method: GET
    HTTP route: /api/DemoUser
    SERVER PROCEDURE: List all Entities by consuming it service layer
*/
export async function list(req, res)
{
    try {
        const
            // set Service Procedure name
            action = "getAll",
            // set who asked for the job
            from = req.user,
            // create a job request message
            job = new RabbitEnvelop( { from, entity, action }),
            /**
                RPC - application.mapperRPC.services.DemoUser.getAll( job )
                execute the job
            */
            { error, data, count, pages, limit, page } = await app.mapperRPC.services[ entity ][ action ]( job ),
            // set job message
            message = ( error.message || error, ( action + " " + entity ) );

        // check if is there a error executing the job
        if( error ) return errorResponse(res, { error, message })
        // respond job result
        return result(res, { data, count, pages, limit, page, message })

    } catch (error) {
        return errorResponse(res, { error, message: error.message })
    }
}


/**
    HTTP Method: GET
    HTTP route: /api/DemoUser/{id}
    SERVER PROCEDURE: Read a specific Entity by consuming it service layer
*/
export async function read(req, res) {
    try {
        const
            // set Service Procedure name
            action = "getById",
            // set who asked for the job
            from = req.user,
            // set payload to execute the job
            payload = {
                [ primaryKeyName ]: req.swagger.params.id.value,
            },
            // create a job request message
            job = new RabbitEnvelop( { from, entity, action, payload }),
            /**
                RPC - application.mapperRPC.services.DemoUser.getById( job )
                execute the job
            */
            { error, data } = await app.mapperRPC.services[ entity ][ action ]( job ),
            // set job message
            message = ( error.message || error, ( action + " " + entity ) );

        // check if is there a error executing the job
        if( error ) return errorResponse(res, { error, message })
        // respond job result
        return result(res, { data, message })

    } catch (error) {
        return errorResponse(res, { error, message: error.message })
    }
}

```





--------------------------
## Using inside a `channel consumer function` function

When you setup a RabbitMQ Subscriber worker, it starts listening to a specific queues.

A worker must have a default `channel consumer function`, in other words, a callback function which is called every time when the worker receives a message from that queue.




> Lets conside the following `src/worker-MsWorker.js` worker application file example:


#### `worker-MsWorker` `worker`

```javascript
'use strict';

import chalk from 'chalk'
import Application from './lib/Application.js'
import RabbitClient from './lib/RabbitClient.js'
import RedisClient from './lib/RedisClient.js'
import MongoClient from './lib/MongoClient.js'
import SequelizeClient from './lib/SequelizeClient'
import RPCMapper from './lib/RPCMapper'
import { validateJob } from './lib/util'


class MsWorker extends SequelizeClient( MongoClient( RabbitClient( RedisClient( Application ) ) ) )
{
    constructor( c )
    {
        // worker constructor
    }

    start()
    {
        // start application services .....
    }

    //
    /**
        channel consumer function
        pertinent to to this application bussins logic
        this function is called all the times when a message arrives
    */
    consumeMessage( msg )
    {
        let self = this;
        ( async () => {
            let job = null,
                isMessageValid = false;

            try {
                job = JSON.parse(msg.content.toString());
                isMessageValid = true;
            } catch (e) {

            }

            if ( ( ! isMessageValid ) || ( ! validateJob( job ) ))
            {
                self.channel.ack(msg)
                if( ! isMessageValid )
                {
                    self.console.error( 'job is not a valid JSON. The received message was removed from the queue.', job )
                }
                else if( ! validateJob( job ) ){
                    isMessageValid = false;
                    self.console.error( 'job is not valid. The received message was removed from the queue.', job )
                }
                return
            }

            /**
                msg is a RabbitMQ AMQP message
                job is a RabbitEnvelop Message
                execute the job
            */
            self.mapperRPC.execute( job, msg )

        } )()
    }
}

export default MsWorker
```
