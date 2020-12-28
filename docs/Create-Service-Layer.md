#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Service layers

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------


A Service Layer, is Basically a class that abstracts all actions which can be performed against a specified Data Entity.

Every Service layer `represents` `just one` `Data Entity`.

Every action is atomic. And you can make a chainned call, in other words, have an action calling another action following a workflow.

Those actions may be `database` related: `Create`, `Update`, `Delete`, `List one`, `List all`  records.

In a more extend scenario, please consider the `Human` `Data Entity`. You could have an action like service.getMarried() which makes creates a kind of relationship between 2 `Humens`.

Not least, those actions may be  also `fyle system` related: `Upload`, `Copy`, `Move`, `Read`, `Edit`, `Delete` files.


--------------------------

## How to create a Hello World service layer example

Lets consider the fake file ``./src/lib/models/services/HelloWorld.js``

Please follow the code and it comments


```javascript
'use strict';
/**
 * Import Service class
 */
import Service from '../Job/Service' // mandatory

/**
 * Class representing a HelloWorld Service
 * @extends Service
 */
class HelloWorld extends Service
{
    /**
     * Creates a HelloWorld Service
     * @constructor
     * @param {object} application - the application object which this service is plugged to
     */
    constructor( application )
    {
        /**
            call super is mandatory and shall to be called first.
        */
        super( application )
        /**
            Specify the Entity name which this service handles.
            The entity shall to have a specified Mongoose or Sequelize model
            The Model, The table (collection) and the data entity must ALL have the same name
        */
        this.entity = 'HelloWorld'
        /**
            Specify the primary key name which this service handles.
            default is _id
            Not mandatory for Non-Database Service layers
        */
        //this.primaryKeyName = 'id'
        /**
            Specify the storage engine - memory, mongo or sequelize
            default is mongo
            Not mandatory for Non-Database Service layers
        */
        //this.setStorageEngine( 'sequelize' ) // default is mongo
    }
    /**
        Server Procedure
        The procedure Name must matche the same name defined in incoming RabbitEnvelop Message
    */
    async action( job, msg )
    {
        /**
            Check if Job request is valid. If not, will fail calling service.jobNotDone()
        */
        if( ! this.isValidJob( job, msg ) ) return { error: `Invalid task` }


        /**
            -------- START HelloWorld Related logic
            Create a data using builtin or commom methods
        */
        let { error, data, status } = await fakeJobBuiltInOrCommonMethod( job )
        if( error )
        {
            /**
                set job as not done
            */
            this.jobNotDone( job, msg, `error creating ${this.entity} - ${error}` )
        }
        else {
            /**
                set job as done
            */
            this.jobDone( job, data, msg )
        }
        /**
            -------- End HelloWorld Related logic
        */

        /**
            All service actions must respond a object like:
                { error, data, status }
            Where:
                - error may be a string or a object representing an error
                - data is the information about the resource created on server (based on job.payload)
                - status http status like
        */
        return { error, data, status }
    }
}

export default HelloWorld
```


--------------------------

## How to create a database based Service Layer


Please check the `DemoUser` example related files at `./src/lib/models/services/DemoUser.js` for a Mongoose based service layer example.

Please check the `PetSequelize` example related files at `./src/lib/models/services/PetSequelize.js` for a Sequelize based service layer example.

### Putting in practice

1. Create a service class under `./src/lib/services/`

    1.1. Create an empty classe and give it name based on the `Data Entity` name that you are going to handle in that service layer

    1.2. Inherits Service class

    1.3. Set the entity name that this service layer is handling

    1.4. Set it database engine, If this service layer is based on a database engine.

    1.5. Set it primary key name, If this service layer is based on a database engine

    1.6. Implement it methods. Methods are also referred as `Remote Procedure` or `action`. The method names must match same name on a `Job Resource Object`.


### DemoUser service layer example

```javascript
'use strict';

import Service from '../Job/Service' // mandatory

/**
 * Class representing a DemoUser Entity Service
 * @extends Service
 */
class DemoUser extends Service
{
    /**
     * Creates a DemoUser Entity Service
     * @constructor
     * @param {object} application - mandatory - the application object which this service is plugged to
     */
    constructor( application )
    {
        /** call super is mandatory and shall to be called first. */
        super( application ) // mandatory to call
        /**
            Specify the Entity name which this service handles.
            The entity shall to have a specified Mongoose or Sequelize model
            The Model, The table (collection) and the data entity must ALL have the same name
        */
        this.entity = 'DemoUser'
        /**
            Specify the primary key name which this service handles.
            default is _id
        */
        this.primaryKeyName = '_id'
        /**
            Specify the storage engine - memory, mongo or sequelize
            default is mongo
        */
        this.setStorageEngine( 'mongo' ) // default is mongo
    }

    /**
     * create a DemoUser Entity
     * @function
     * @param {object} job - mandatory - a job object representing the job information to create a DemoUser Entity
     * @param {buffer} msg - a buffer representing the rabbitmq message
     * @return {object} { error, data }
     */
    async create( job, msg )
    {
        /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
        if( ! this.isValidJob( job, msg ) ) return { error: `Invalid task` }
        /**
            Create a data using builtin CRUD class
        */
        let { error, data, status }  = await this.createRecord( job )
        if( error )
        {
            /**
                set job as not done
            */
            this.jobNotDone( job, msg, `error creating ${this.entity} - ${error}` )

        }
        else {
            /**
                set job as done
            */
            this.jobDone( job, data, msg )
        }
        console.log('data', data)
        console.log('error', error)
        return { error, data, status }
    }

    /**
     * update a DemoUser Entity
     * @function
     * @param {object} job - mandatory - a job object representing the job information to update a DemoUser Entity
     * @param {buffer} msg - a buffer representing the rabbitmq message
     * @return {object} { error, data }
     */
    async update( job, msg )
    {
        /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
        if( ! this.isValidJob( job, msg ) ) return { error: `Invalid task` }
        /**
            Update a data using builtin CRUD class
        */
        let { error, data, status } = await this.updateRecord( job )
        if( error )
        {
            /**
                set job as not done
            */
            this.jobNotDone( job, msg, `error updating ${this.entity} - ${error}` )
        }
        else {
            /**
                set job as done
            */
            this.jobDone( job, data, msg )
        }
        console.log('data', data)
        console.log('error', error)
        return { error, data, status }
    }

    /**
     * delete a DemoUser Entity
     * @function
     * @param {object} job - mandatory - a job object representing the job information to delete a DemoUser Entity
     * @param {buffer} msg - a buffer representing the rabbitmq message
     * @return {object} { error, data }
     */
    async delete( job, msg )
    {
        /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
        if( ! this.isValidJob( job, msg ) ) return { error: `Invalid task` }
        /**
            Delete a data using builtin CRUD class
        */
        let { error, data, status } = await this.deleteRecord( job )
        if( error )
        {
            /**
                set job as not done
            */
            this.jobNotDone( job, msg, `error deleting ${this.entity} - ${error}` )
        }
        else {
            /**
                set job as done
            */
            this.jobDone( job, data, msg )
        }
        console.log('data', data)
        console.log('error', error)
        return { error, data, status }
    }

    /**
     * get all DemoUser Entity
     * @function
     * @param {object} job - mandatory - a job object representing the job information to get all Records
     * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
     * @param {buffer} msg - a buffer representing the rabbitmq message
     * @return {object} { error, data }
     */
    async getAll( job, msg )
    {
        // use inherited Service resources
        /**
            get all records using builtin CRUD class
        */
        let { error, data, status, count, pages, limit, page } = await this.getAllRecords( job )
        if( error )
        {
            /**
                set job as not done
            */
            this.jobNotDone( job, msg, `error getting all ${this.entity} records - ${error}` )
        }
        else {
            /**
                set job as done
            */
            this.jobDone( job, data, msg )
        }
        console.log('data', data)
        console.log('error', error)
        return { error, data, status, count, pages, limit, page }
    }

    /**
     * get DemoUser Entity by it Id
     * @function
     * @param {object} job - mandatory - a job object representing the job information to get one Record based on it Id
     * Must contains the _id field
     * job.payload May contains the populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
     * @param {buffer} msg - a buffer representing the rabbitmq message
     * @return {object} { error, data }
     */
    async getById( job, msg )
    {
        // use inherited Service resources
        /**
            Get one data based on ID using builtin CRUD class
        */
        let { error, data, status } = await this.getRecordById( job )
        if( error )
        {
            /**
                set job as not done
            */
            this.jobNotDone( job, msg, `error getting ${this.entity} by Id - ${error}` )
        }
        else {
            /**
                set job as done
            */
            this.jobDone( job, data, msg )
        }
        console.log('data', data)
        console.log('error', error)
        return { error, data, status }
    }

    /**
     * get One DemoUser Entity
     * @function
     * @param {object} job - mandatory - a job object representing the job information get one Record.
     * job.payload May contains the where (both), populate (mongoose), select (mongoose), include (sequelize) and attributes (sequelize)
     * @param {buffer} msg - a buffer representing the rabbitmq message
     * @return {object} { error, data }
     */
    async getOne( job, msg )
    {
        // use inherited Service resources
        /**
            Get one data based on ID using builtin CRUD class
        */
        let { error, data, status } = await this.getOneRecord( job )
        if( error )
        {
            /**
                set job as not done
            */
            this.jobNotDone( job, msg, `error getting one ${this.entity} data - ${error}` )
        }
        else {
            /**
                set job as done
            */
            this.jobDone( job, data, msg )
        }
        console.log('data', data)
        console.log('error', error)
        return { error, data, status }
    }
}

export default DemoUser

```
