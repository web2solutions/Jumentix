#   <img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /> CRUD Class

Entry and Proxy interface to handle CRUD database operations.

Every service layer inherits this class automatically (Or should do).

This class acts as a proxy to every store engine supported by this framework.

When calling a `Built In` `CRUD` method, it will be automatically be mapped to the specified underlying Data Framework method.

Implemented Data Frameworks are:

- Mongoose
- Sequelize

***Type***: `class`


[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------
## Implemented Properties


--------------------------
## Implemented Methods


#### `async service.createRecord( job )`

Create one record.

The payload must be provided containing the new record data.
The payload can not have a primary key field

Example:

```javascript
let job = {
    // ...
    payload: {
        first_name: 'Mark',
        last_name: ' Livings',
        email: 'mark.livings@cairsolutions.com'
    }
}

let response = await service.createRecord( job )
```


#### `async service.updateRecord( job )`

Update one record based on it primary key value.

The primary key value must be provided inside `job.payload`

Example:

```javascript
let job = {
    // ...
    payload: {
        _id: '5c585ab5bfbfa98b7b966bd1',
        first_name: 'new First name'
    }
}

let response = await service.updateRecord( job )
```


#### `async service.deleteRecord( job )`

Delete one record based on it primary key value.

The primary key value must be provided inside `job.payload`

Example:

```javascript
let job = {
    // ...
    payload: {
        _id: '5c585ab5bfbfa98b7b966bd1'
    }
}

let response = await service.deleteRecord( job )
```



#### `async service.getRecordById( job )`

Get one record based on it primary key value.

`job.payload.populate` field is available to use alongside Mongoose `populate` method

`job.payload.select` field is available to use alongside Mongoose `select` method

`job.payload.attributes` field is available to use alongside Sequelize query `attributes` property

`job.payload.include` field is available to use alongside Sequelize query `include` property

`job.payload.table` field is available to specify a different table to query out rather than the one set by Data Entity name. Sequelize

`job.payload.collection` field is available to specify a different collection to query out rather than the one set by Data Entity name. Mongoose

The primary key value must be provided inside `job.payload`

Example:

```javascript
let job = {
    // ...
    payload: {
        _id: '5c585ab5bfbfa98b7b966bd1'
    }
}

let response = await service.getRecordById( job )
```



#### `async service.getAllRecords( job )`

Get all records based on a where clausule.

`job.payload.populate` field is available to use alongside Mongoose `populate` method

`job.payload.select` field is available to use alongside Mongoose `select` method

`job.payload.attributes` field is available to use alongside Sequelize query `attributes` property

`job.payload.include` field is available to use alongside Sequelize query `include` property

`job.payload.table` field is available to specify a different table to query out rather than the one set by Data Entity name. Sequelize

`job.payload.collection` field is available to specify a different collection to query out rather than the one set by Data Entity name. Mongoose

The primary key value must be provided inside `job.payload`

Example:

```javascript
let job = {
    // ...
    payload: {
        where: {
            active: true
        },
        populate: 'subDocumentName_1,subDocumentName_2'
    }
}

let response = await service.getAllRecords( job )
```



#### `async service.getOneRecord( job )`

Get one record based on a where clausule.

`job.payload.populate` field is available to use alongside Mongoose `populate` method

`job.payload.select` field is available to use alongside Mongoose `select` method

`job.payload.attributes` field is available to use alongside Sequelize query `attributes` property

`job.payload.include` field is available to use alongside Sequelize query `include` property

`job.payload.table` field is available to specify a different table to query out rather than the one set by Data Entity name. Sequelize

`job.payload.collection` field is available to specify a different collection to query out rather than the one set by Data Entity name. Mongoose

The primary key value must be provided inside `job.payload`

Example:

```javascript
let job = {
    // ...
    payload: {
        where: {
            active: true
        },
        populate: 'subDocumentName_1,subDocumentName_2'
    }
}

let response = await service.getOneRecord( job )
```
