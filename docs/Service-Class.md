#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Service Class

Every service layer implemented using this framework must inherit this class

This class acts as a proxy to every store engine supported by this framework.

When calling a `Built In` `CRUD` method, it will be automatically be mapped to the specified underlying Data Framework method.

Implemented Data Frameworks are:

- Mongoose
- Sequelize

***Type***: `class`


[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------
## Implemented Properties


#### `service.storageEngine`

String - memory, mongo or sequelize

Default: mongo


#### `service.primaryKeyName`

String - primary key name

Default: '_id'


#### `service.application`

Object - holds application object


#### `service.isJobDone`

Boolean - holds a falg that indicates the job execution status

Default: false



#### `service.isCached`

Boolean - holds a falg that indicates if entity should be cached on Redis

Default: false



#### `service.isCachedBasedOnUser`

Boolean - Specify this entity collection data should be cached based on user id, entity name and filter. If false, caches will be created based on entity name  and filter only.

Default: false


#### `service.cacheExpiresIn`

Number - Specify in how long time the cache will expires in seconds.

Default: 3600 seconds


--------------------------
## Implemented Methods

#### `service.setStorageEngine(  'engine name'  )`

Set service storage engine. Values are memory, mongo and sequelize

#### `service.sendNotification ( job, data, isJobDone, err)`

Send notifications to the Ochestrator worker's queue

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`data`* - Object - is the final handled server resource object

*`isJobDone`* - Boolean - indicates Job status

*`err`* - Object or String - error information


#### `service.sendErrorNotification( job, errorMessage )`

Send error notifications to the Ochestrator worker's queue

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`err`* - Object or String - error information


#### `service.sendClientNotification ( c )`

Send client notifications via Mediator

***Parameters:***

*`c`*

Object - holds notification resource

*`c.job`*

Object - is the incoming `Job Resource Object`. Mandatory.

*`c.data`*

Object - is the final handled server resource object. Not Mandatory.

If provided, will automatically set Job status as `done`.

If not provided, will automatically set Job status as `not done`.

*`c.error`*

Object or String - error information


#### `service.isValidJob( job, msg )`

Validate a Job.

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`msg`* - Buffer - a buffer representing the rabbitmq message


#### `service.jobDone( job, data, msg )`

Set job as done and and execute notification / logging actions

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`data`* - Object - is the final handled server resource object

*`msg`* - Buffer - a buffer representing the rabbitmq message



#### `service.jobNotDone( job, msg, errMessage )`

Set job as done and and execute notification / logging actions

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`msg`* - Buffer - a buffer representing the rabbitmq message

*`errMessage`* - String - Error message





#### `service.add_file( job, msg )`

add an file to a Entity

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`msg`* - Buffer - a buffer representing the rabbitmq message



#### `service.delete_file( job, msg )`

delete a file from an Entity

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`msg`* - Buffer - a buffer representing the rabbitmq message



#### `service.create( job, msg )`

create an Entity record into database

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.


```javascript
    {
        "from": {
            "userId" : 444,
            "companyId" : 243,
            "user_email" : "eduardo.almeida@cairsolutions.com",
            "name": "Jose Eduardo",
            "id": 'dskfjhldsfh879879dsaf'
        },
        "entity" : "DemoUser",
        "action" : "create",
        "payload" :
        {
            "first_name" : "Eduardo",
            "last_name" : "Almeida",
            "email" : "web2solucoes@gmail.com"
        }
    }
```




*`msg`* - Buffer - a buffer representing the rabbitmq message










#### `service.update( job, msg )`

update an Entity on Database

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.


```javascript
    {
        "from": {
            "userId" : 444,
            "companyId" : 243,
            "user_email" : "eduardo.almeida@cairsolutions.com",
            "name": "Jose Eduardo",
            "id": 'dskfjhldsfh879879dsaf'
        },
        "entity" : "DemoUser",
        "action" : "update",
        "payload" :
        {
            "_id": "5c585ab5bfbfa98b7b966bd1",
            "last_name" : "Almeidaaaaa"
        }
    }
```




*`msg`* - Buffer - a buffer representing the rabbitmq message






#### `service.delete( job, msg )`

Soft delete an entity from Database. (virtual delete - set record as deleted)

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.


```javascript
    {
        "from": {
            "userId" : 444,
            "companyId" : 243,
            "user_email" : "eduardo.almeida@cairsolutions.com",
            "name": "Jose Eduardo",
            "id": 'dskfjhldsfh879879dsaf'
        },
        "entity" : "DemoUser",
        "action" : "delete",
        "payload" :
        {
            "_id": "5c585ab5bfbfa98b7b966bd1"
        }
    }
```

*`msg`* - Buffer - a buffer representing the rabbitmq message









#### `service.delete_hard( job, msg )`

Hard delete an entity from Database. (physical delete)

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`msg`* - Buffer - a buffer representing the rabbitmq message


#### `service.restore( job, msg )`

Restore a soft deleted Entity

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

*`msg`* - Buffer - a buffer representing the rabbitmq message


#### `service.getAll( job, msg )`

Get list of the entity records from database

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.


```javascript
    {
        "from": {
            "userId" : 444,
            "companyId" : 243,
            "user_email" : "eduardo.almeida@cairsolutions.com",
            "name": "Jose Eduardo",
            "id": 'dskfjhldsfh879879dsaf'
        },
        "entity" : "DemoUser",
        "action" : "getAll",
        "payload" :
        {
            "where": {
                "active": true
            },
            "populate": 'objectname'
        }
    }
```


*`msg`* - Buffer - a buffer representing the rabbitmq message








#### `service.getById( job, msg )`

Get an entity record from database by ID

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.



```javascript
    {
        "from": {
            "userId" : 444,
            "companyId" : 243,
            "user_email" : "eduardo.almeida@cairsolutions.com",
            "name": "Jose Eduardo",
            "id": 'dskfjhldsfh879879dsaf'
        },
        "entity" : "DemoUser",
        "action" : "getById",
        "payload" :
        {
            "_id": "5c585ab5bfbfa98b7b966bd1",
            "populate": 'objectname'
        }
    }
```


*`msg`* - Buffer - a buffer representing the rabbitmq message







#### `service.getOne( job, msg )`

Get an entity record from database based on filtering

***Parameters:***

*`Job`* - Object - is the incoming `Job Resource Object`. Mandatory.

```javascript
    {
        "from": {
            "userId" : 444,
            "companyId" : 243,
            "user_email" : "eduardo.almeida@cairsolutions.com",
            "name": "Jose Eduardo",
            "id": 'dskfjhldsfh879879dsaf'
        },
        "entity" : "DemoUser",
        "action" : "getOne",
        "payload" :
        {
            "where": {
                "first_name": "Eduardo",
            },
            "populate": 'objectname'
        }
    }
```



*`msg`* - Buffer - a buffer representing the rabbitmq message



## Inherited CRUD methods

Please check the [CRUD documentation](./CRUD-Class.md) to see all methods inherited from `CRUD class` that are available into `Service Class`




## `Job Resource` object - full example

The `Job Resource` object is a well known structure used as communication stardard to describe a server job.

Workers and Rest APIs using this framework will use this pattern to consume a service class


```javascript
    "from": {
        "userId" : 444,
        "companyId" : 243,
        "user_email" : "eduardo.almeida@cairsolutions.com",
        "name": "Jose Eduardo",
        "id": 'dskfjhldsfh879879dsaf'
    },
    "entity" : "DemoUser",
    "action" : "delete",
    "payload" :
    {
        "_id": "5c585ab5bfbfa98b7b966bd1"
    }
```






