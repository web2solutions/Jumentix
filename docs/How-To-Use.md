#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> How to use the Framework?

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------

#### Step 1. Clone this repository

```bashrc
    $ git clone https://github.com/web2solutions/Jumentix.git myNewApplication

    $ cd myNewApplication

    $ npm install
```


#### Step 2. Create your application file. Example: MsWorker.js

```bashrc
    $ vim myNewApplication.js
```


#### Step 3. Create the Node.js application entry.

```bashrc
    $ vim myApplication.js
```

Hello World app:

```javascript
import Application from './Application.js'
import RabbitClient from './RabbitClient.js'
import RedisClient from './RedisClient.js'
import MongoClient from './MongoClient.js'
import SequelizeClient from './SequelizeClient'


class MyNewApplication extends SequelizeClient( MongoClient( RabbitClient( RedisClient( Application ) ) ) )
{
    constructor( c )
    {
        super()
        this.console.banner('Starting ' + this.config.app.name)
        this.app = null
        this.c = c || {
            sequelize: false,
            mongo: false
        }
    }


    async start()
    {
        let self = this
        try
        {
            await self.startRedis()
            if( self.c.mongo )
            {
                await self.startMongo()
            }
            if( self.c.sequelize )
            {
                await self.startSequelize()
            }

            await self.startMQ()

            process.on('SIGINT', async () =>
            {
                console.log("process SIGINT")
                await self.serviceStop()
                process.exit(-1)
            })

            return true
        }
        catch (e)
        {
            console.log(chalk.redBright(`Could not start ` + self.config.app.name))
            return Error(e)
        }
    }

    // pertinent to to this application bussins logic
    consumeMessage( msg )
    {
        // custom code to consume rabbitMQ messages
    }
}

```

#### Step 4. Setup the configuration files.

see:

    .
    ├── config
    │   ├── config.json             # Sequelize connection configuration file
    │   └── deploy.json             # Auto-Deploy configuration file
    ├── src                         # ES6 Source files
    │   ├── config                      # App conf files
    │   │   ├── compiler_config.js      # babel and webpack compilers
    │   │   ├── gmail.js                # gmail account configuration
    │   │   ├── index.js                # General application  configuration
    │   │   ├── mailgun.js              # mailgun account configuration
    │   │   ├── mq.js                   # Rabbitmq configuration
    │   │   └── redis.js                # Redis configuration
    └── ...


#### Step 5. Write your Application custom class code using the whole built in features.

MsWorker.js application example:

```javascript
'use strict';

import chalk from 'chalk'
import Application from './Application.js'
import RabbitClient from './RabbitClient.js'
import RedisClient from './RedisClient.js'
import MongoClient from './MongoClient.js'
import SequelizeClient from './SequelizeClient'
import RPCMapper from './RPCMapper'
import { validateJob } from './util'


class MsWorker extends SequelizeClient( MongoClient( RabbitClient( RedisClient( Application ) ) ) )
{
    constructor( c )
    {
        super()
        this.console.banner('Starting ' + this.config.app.name)
        this.app = null
        this.c = c || {
            sequelize: false,
            mongo: false
        }

        this.mapperRPC = null
    }

    async start()
    {
        let self = this
        try
        {
            await self.startRedis()
            if( self.c.mongo )
            {
                await self.startMongo()
            }
            if( self.c.sequelize )
            {
                await self.startSequelize()
            }

            await self.startMQ()

            self.mapperRPC = new RPCMapper( self )

            await self.mapperRPC.mapServices()

            process.on('SIGINT', async () =>
            {
                console.log("process SIGINT")
                await self.serviceStop()
                process.exit(-1)
            })

            //console.log( 'models', self.models )


            self.console.banner(self.config.app.name + ' is started ')
            return true
        }
        catch (e)
        {
            console.log(chalk.redBright(`Could not start ` + self.config.app.name))
            return Error(e)
        }
    }

    // pertinent to to this application bussins logic
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

            if( job.entity == "_worker_" )
            {
                // if message was not set to this worker
                if( job.payload.workerName.toUpperCase() != self.config.mq.workerName )
                {
                    self.console.log( 'ignoring ' + job.action + ' message.' );
                    self.channel.reject(msg);
                    return;
                }
            }

            // lets check if message is to stop or restart the worker
            if( job.entity == "_worker_" && job.action == 'stop' )
            {
                self.channel.ack(msg);
                self.console.log( 'going to ' + job.action + ' in 2 seconds.' );
                await self.stopProcess()
            }
            else if( job.entity == "_worker_" && job.action == 'restart' )
            {

                self.channel.ack(msg);
                console.log( 'going to ' + job.action + ' in 2 seconds.' );
                // remove shutdown message from queue
                await self.restartProcess()
            }
            // if not, then call controller.execute()
            else
            {
                // let set job in progress
                try {
                    self.redis.store.set('JobInProgress_' + self.config.mq.workerName, JSON.stringify( job ) )
                } catch (e) {
                    console.log(e)
                } finally {
                    self.mapperRPC.execute( job, msg )
                }
            }
        } )()
    }
}

export default MsWorker
```


#### Step 6. Call your application class into a Node.js application entry.

app.js application entry example:

```javascript
'use strict';

// babel es6 compiler - support async await. import polyfill and core
import './config/compiler_config'

import MsWorker from './MsWorker'

let started = false,
    worker = new MsWorker({
        sequelize: false, // require VPN connection
        mongo: true
    });

( async function(){
    if( ! started )
    {
        await worker.start()
        started = true
    }
} )()

export default worker
```

#### Step 7. Configure the `package.json` file
