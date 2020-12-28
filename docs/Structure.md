#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Project Structure


[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

---------------------

### Project main structure


    .
    ├── .circleci
    │   └──config.yml               # CircleCI Continuos Integration Tool configuration
    │
    ├── config
    │   ├── config.json             # Sequelize connection configuration file
    │   └── deploy.json             # Auto-Deploy configuration file *
    │
    ├── deploy
    │   ├── production.deploy.js    # Production env deployer
    │   └── production.deploy.js    # Test env deployer
    │
    ├── dist                        # Compiled ES5 files
    │
    ├── docs                        # Jerkill documentation files (.md)
    │
    ├── log                         # Stores .log files
    │
    ├── migrations                  # Store sequelize migration files
    │
    ├── src                         # ES6 Source files
    │
    ├── test                        # Test suite for REST APIs
    │
    ├── testers                     # Test scripts for Workers
    │
    ├── .babelrc                    # Babel compiler configuration
    ├── .editorconfig               # set default IDE configuration across developers
    ├── .eslintignore               # eslint ignore rules
    ├── .eslintrc                   # eslint configuration
    ├── .gitattributes              # git related file
    ├── .gitignore                  # git related file
    ├── travis.yml                  # Travis Continuos Integration Tool configuration
    ├── gulpfile.babel.js           # Gulp file - code automation
    ├── nodemon.json                # nodemon configuration - dev server
    ├── package.json                # package file
    ├── pm2.cluster.config.js       # pm2 cluster config
    ├── pm2.dev.config.js           # pm2 config for dev server
    ├── pm2.simple.config.js        # pm2 fork config
    ├── README.md                   # main readme file
    └── sequelize-meta.json         # Sequelize migration data


* See: [https://github.com/web2solutions/Auto-Deploy](https://github.com/web2solutions/Auto-Deploy)



### Application Source structure

    .
    ├── src                                         # ES6 codebase
    │   │
    │   ├── lib                                     # Framework library files
    │   │   ├── api
    │   │   │   ├── controllers                     # general HTTP REST controllers
    │   │   │   └── swagger                         # general swagger specification files
    │   │   │
    │   │   ├── auth
    │   │   │   ├── controllers                     # Auth related HTTP REST controllers
    │   │   │   ├── passports                       # Passports - auth schemas
    │   │   │   ├── services                        # Auth related services
    │   │   │   └── swagger                         # swagger specification for Auth
    │   │   │
    │   │   ├── DataAccess
    │   │   │   ├── CRUD.js                         # Core Service -  CRUD class
    │   │   │   ├── DataAPI.js                      # Data Proxy Class
    │   │   │   ├── MongooseAPI.js                  # Mongoose built in methods
    │   │   │   └── SequelizeAPI.js                 # Sequelize Built in methods
    │   │   │
    │   │   ├── express
    │   │   │   └── index.js                        # Express.js middleware setup
    │   │   │
    │   │   ├── Job
    │   │   │   ├── Job.js                          # Core Service -  Job class
    │   │   │   └── Service.js                      # Core Service -  Service class
    │   │   │
    │   │   ├── models
    │   │   │   ├── mongoose                        # Mongoose models
    │   │   │   ├── sequelize                       # Sequelize models
    │   │   │   ├── RecordDefaultProperties.js      # Sequelize default record properties
    │   │   │   └── DocumentDefaultProperties.js    # Mongoose default document properties
    │   │   │
    │   │   ├── redis-jwt
    │   │   │   └── index.js                        # Interface for Redis-JWT
    │   │   │
    │   │   ├── services
    │   │   │   ├── DemoUser.js                     # DemoUser Mongoose service - EXAMPLE
    │   │   │   ├── Example.js                      # Hello World - EXAMPLE
    │   │   │   ├── Gmail.js                        # Gmail Custom service - EXAMPLE
    │   │   │   ├── Human.js                        # Human Mongoose service - RC
    │   │   │   ├── QuickBooksToken.js              # QuickBooksToken Mongoose service - RC
    │   │   │   └── User.js                         # User Mongoose service - RC
    │   │   │
    │   │   ├── swagger
    │   │   │   ├── ui                              # API documentation UI
    │   │   │   ├── config.js                       # Swagger API configuration
    │   │   │   └── index.js                        # Swagger middleware for Express.js
    │   │   │
    │   │   ├── templates
    │   │   │   └── email.html                      # handler bar template used on emails
    │   │   │
    │   │   ├── Application.js                      # Application Core class
    │   │   ├── composer.js                         # RabbitEnvelop shortcut used by ./testers/ scripts
    │   │   ├── ExpressServer.js                    # Express.js server Core Class
    │   │   ├── MongoClient.js                      # Mongo Client Mongoose based Core Class
    │   │   ├── RabbitClient.js                     # RabbitMQ Client amqp module based Core Class
    │   │   ├── RabbitEnvelop.js                    # Message Composing Core Class
    │   │   ├── RedisClient.js                      # Redis Client redis module based Core Class
    │   │   ├── response.js                         # Standard REST response functions - Core Module
    │   │   ├── RPCMapper.js                        # MAP incoming messages to a specific Data Entity service layer
    │   │   ├── SequelizeClient.js                  # SQL Client Sequelize based Core Class
    │   │   └── util.js                             # Helpers - Core Module
    │   │
    │   ├── config                                  # App conf files
    │   │   ├── default-0.json                      # instance 0 default node env config file
    │   │   ├── default.js                          # General application  configuration (index.js clone)
    │   │   ├── gmail.js                            # gmail account configuration
    │   │   ├── index.js                            # General application  configuration
    │   │   ├── mailgun.js                          # mailgun account configuration
    │   │   ├── mq.js                               # Rabbitmq configuration
    │   │   └── redis.js                            # Redis configuration
    │   │
    │   ├── app.js                                  # Nodejs application entry. REST API Example.
    │   ├── MsRESTAPI.js                            # Custom application class. REST API Example.
    │   │
    │   ├── worker-app.js                           # Nodejs application entry. Worker Example.
    │   └── worker-MsWorker.js                      # Custom application class. Worker Example.
    └── ...
