#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Redis Client Class

The RedisClient class provide support for Redis usage into the application.

*Applications created using this framework must inherits this class.*

*Type*: mixin class without constructor

*Example*:

```javascript
class MyNewApplication extends RedisClient( Application )
{

}
```



[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

## Dependency

- [redis](https://www.npmjs.com/package/redis)

NPM Redis Library



--------------------------
## Implemented Methods


#### `async application.startRedis()`

Starts Redis client layer

Setup Redis related application properties.



----
#### `async application.connectRedis()`

Set `application.redis.store` and associate a Redis (redis module) connection

Call `application.setStoreEvents()`






----
#### `async application.setStoreEvents()`

Setup Redis Store events.

Resolves when `application.redis.store.onReady` event is triggered



#### `async application.stopRedis()`

Calls application.redis.store.quit()
