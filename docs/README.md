#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Documentation preface

JumentiX

Application foundation for REST and Realtime Node.JS micro service applications

## Introduction and key concepts

- [key concepts Documentation](./Introduction.md)
- [Project Structure Documentation](./Structure.md)

# Implemented Classes


## Core related classes

- [Application Class](./Application-Class.md)

`Logging`, `stats` and `monitoring`, `messaging`.

- [ExpressServer Class](./ExpressServer-Class.md)

Web server implementation with REST tools on the box.

- [MongoClient Class](./MongoClient-Class.md)

Class interface consuming `Mongoose` library

- [RabbitClient Class](./RabbitClient-Class.md)

Class interface consuming `amqp` library


- [RedisClient Class](./RedisClient-Class.md)

Class interface consuming `redis` library

- [SequelizeClient Class](./SequelizeClient-Class.md)

Class interface consuming `Sequelize` library

## Service related classes

- [CRUD Class](./CRUD-Class.md)

Class that implements a `unified data API` supporting every implemented storage engine.

- [Service Class](./Service-Class.md)

Class that implements methods related to `jobs execution`

## Helper classes

- [RabbitEnvelop Class](./RabbitEnvelop-Class.md)

Class that `composes RabbitMQ` messages to be used inside the `Distributed Computing Network`

- [RPCMapper Class](./RPCMapper-Class.md)


Class that `maps messages` across `Service Layers` and it `actions/procedures`

## Helper modules

- [util](./util-module.md)

Commom helper functions

- [DocumentDefaultProperties](./DocumentDefaultProperties-module.md)

Common properties for Mongoose models

- [RecordDefaultProperties](./RecordDefaultProperties-module.md) ***TODO***

Common properties for Sequelize models

# How to use?


- [Quick start - Code automation](./Code-automation.md)


## Built in Database APIs

- [Quick start - Using built in Data Storage APIs](./Data-Storage-APIs.md)

## Built in Message Sender API

- [Quick start - Message Sender API](./Sender-API.md)

## Data Entity's Micro Services

- [Quick start - creating service layers](./Create-Service-Layer.md)
- [Quick start - creating model layers](./Create-Model-Layer.md)
- [Quick start - creating swagger definitions](./Create-Swagger-definitions-Layer.md)
- [Quick start - creating swagger routes](./Create-Swagger-routes-Layer.md)
- [Quick start - creating REST controllers](./Create-Rest-Controllers.md)


## Using Swagger to generate UIs

- [Intro](./Using-Swagger-to-generate-UI.md)



## Configuring the application

- [Quick start - General configuration](./How-To-Use.md) ***TODO***
- [Quick start - RabbitMQ configuration](./How-To-Use.md) ***TODO***
- [Quick start - Redis configuration](./How-To-Use.md) ***TODO***
- [Quick start - Mailgun configuration](./How-To-Use.md) ***TODO***
- [Quick start - Gmail configuration](./How-To-Use.md) ***TODO***
- [Quick start - Sequelize configuration](./How-To-Use.md) ***TODO***
- [Quick start - Sequelize migration](./How-To-Use.md) ***TODO***



## Creating applications

- [Quick start - How to create a REST API](https://github.com/web2solutions/MS-REST-API) ***TODO***
- [Quick start - How to create a Worker](https://github.com/web2solutions/MS-Worker) ***TODO***
- [Quick start - How to use the Framework](./How-To-Use.md) ***TODO***








# Branches build status

>
> Master branch
>
>`CircleCI` [![CircleCI](https://circleci.com/gh/web2solutions/Jumentix/tree/master.svg?style=svg&circle-token=89993e712f694f8c77e0aaf8d74686aa337bf6f5)](https://circleci.com/gh/web2solutions/Jumentix/tree/master)
