#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> REST HTTP Controllers


A `REST HTTP controller` is a code layer which handles incoming HTTP requests to a specific server resource. For example ***/api/`DemoUser`***

It implements and export functions/methods that supports multiple `HTTP Methods` like GET, POST, PUT, DEL, PATCH to offer different actions/operations against a server resource.

Commonly in a application, the database operations are performed in a `REST HTTP controller`. But this will not be the standard here.

Every controller method receives two paramaters by default: `req and res`, which stands for `Request` and `Response` `HTTP objects`.

The `HTTP Request Message`, which is a plain text Message received by the Controller is then `translated into a message format` which is the standard used to perform communication between `HTTP (REST APIs)` and `AQMP (Workers)` based `micro services`

After formating the incoming `HTTP Request Message`, we can use it to directly consume a `Service Layer Action`, or send it to a specific `RabbitMQ Queue`.



[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------

## How to create a REST HTTP controller to handle the DemoUser Data Entity related Remote Procedure Calls?


Please check the `DemoUser` example related files at `./src/lib/api/controllers/DemoUser.js`.



### DemoUser REST HTTP controller


```javascript
/**
    import REST response functions
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
    /**
        Data Entity name which this controller handler out
    */
    entity = "DemoUser",
    /**
        Queue Name which this controller sends out RabbitMQ message for WRITE operations
    */
    queue = `JumentiX.${entity}`,
    /**
        Primary key name for this Data Entity. _id is Mongo default
    */
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

/**
    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    Following WRITE operations are performed by sending messages to Entity's queue
    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
*/


/**
    Create an entity by sending a message to it queue.
*/
export async function create(req, res)
{
    try {
        const
            // set Service Procedure name
            action = "create",
            // set who asked for the job
            from = req.user,
            // set payload to execute the job
            payload = req.body,
            // create a job request message
            job = new RabbitEnvelop( { from, entity, action, payload }),
            // set job message
            message = 'Your request is being processed and you be notified coming soon.',
            // set message to Entity's queue
            { sent, error } = app.sender.send.messageToQueue( queue, job );

        // check if is there a error executing the job
        if( error ) return errorResponse(res, { error, message: error.message })
        // respond
        return accepted(res, { data: job, message })



    } catch (error) {
        return errorResponse(res, { error, message: error.message })
    }
}

/**
    Update an entity by sending a message to it queue.
*/
export async function update(req, res) {
    try {
        const
            // set Service Procedure name
            action = "update",
            // set who asked for the job
            from = req.user,
            // set payload to execute the job
            payload = copy(  req.body, { [ primaryKeyName ]: req.swagger.params.id.value }),
            // create a job request message
            job = new RabbitEnvelop( { from, entity, action, payload }),
            // set job message
            message = 'Your request is being processed and you be notified coming soon.',
            // set message to Entity's queue
            { sent, error } = app.sender.send.messageToQueue( queue, job );

        // check if is there a error executing the job
        if( error ) return errorResponse(res, { error, message: error.message })
        // respond
        return accepted(res, { data: job, message })

    } catch (error) {
        return errorResponse(res, { error, message: error.message })
    }
}

/**
    Delete an entity by sending a message to it queue.
*/
export async function destroy(req, res) {
    try {
        const
            // set Service Procedure name
            action = "delete",
            // set who asked for the job
            from = req.user,
            // set payload to execute the job
            payload = {
                [ primaryKeyName ]: req.swagger.params.id.value,
            },
            // create a job request message
            job = new RabbitEnvelop( { from, entity, action, payload }),
            // set job message
            message = 'Your request is being processed and you be notified coming soon.',
            // set message to Entity's queue
            { sent, error } = app.sender.send.messageToQueue( queue, job );

        // check if is there a error executing the job
        if( error ) return errorResponse(res, { error, message: error.message })
        // respond
        return accepted(res, { data: job, message })

    } catch (error) {
        return errorResponse(res, { error, message: error.message })
    }
}


```
