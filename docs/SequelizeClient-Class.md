#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Sequelize Client Class

The SequelizeClient class provide support for `SQL databases over Sequelize` usage into the application.

*Applications created using this framework must inherits this class.*

*Type*: mixin class without constructor

*Example*:

```javascript
class MyNewApplication extends SequelizeClient(  Application  )
{

}
```



[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

## Dependency

- [Sequelize](http://docs.sequelizejs.com/)

NPM Sequelize Library


--------------------------
## Implemented Methods


#### `async application.startSequelize()`



#### `async application.connectSequelize()`



#### `async application.setSequelizeEvents()`



#### `async application.stopSequelizeDB()`



#### `async application.mapModels()`
