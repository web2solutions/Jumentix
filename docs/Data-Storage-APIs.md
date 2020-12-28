#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Database Usage

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------




## Directly accessing built in databases engine from inside a service

This framework provides a commom API to access it available storage engine service clients.

The store API is built over the `Application` instance.

### Putting in practice

Actually we provide support to 2 storage engines: Sequelize and Mongoose




#### Accessing Mongoose models from inside a service layer

Lets suppose you need to handle the DemoUser collection from mongoose from inside a service layer method.

All you need is to directly call the model object from `application.$models.mongoose` API. Example:

Mongoose API object at `application.$models` API

```javascript
this.application.$models.mongoose
```

Find all DemoUser example:

```javascript
await this.application.$models.mongoose.DemoUser.find()

// or

await this.application.$models.mongoose[ this.entity ].find()
```



#### Accessing Sequelize models

Lets suppose you need to handle the DemoUser table from SQL server from inside a service layer. All you need is to directly call the model object from `application.$models.sequelize` API, example:

Sequelize API object at `application.$models` API

```javascript
this.application.$models.sequelize
```

Find all DemoUser example:

```javascript
await this.application.$models.sequelize.DemoUser.findAll()
// or

await this.application.$models.sequelize[ this.entity ].findAll()
```
