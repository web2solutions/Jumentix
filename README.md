#   <img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" />  JumentiX 

<p align="center">
  <img src="https://s3.amazonaws.com/creation.howrse.com/100030077-normal.png" align="center" width="200" />
</p>


Application foundation for REST and Realtime Node.JS micro service applications

Read docs at: [https://web2solutions.github.io/Jumentix/](https://web2solutions.github.io/Jumentix/)


> `CircleCI` [![CircleCI](https://circleci.com/gh/web2solutions/Jumentix/tree/master.svg?style=svg&circle-token=89993e712f694f8c77e0aaf8d74686aa337bf6f5)](https://circleci.com/gh/web2solutions/Jumentix/tree/master) [![codecov](https://codecov.io/gh/web2solutions/JumentiX/branch/master/graph/badge.svg?token=weHb2Qp2hK)](https://codecov.io/gh/web2solutions/JumentiX) ![deps](https://img.shields.io/librariesio/github/web2solutions/JumentiX) [![Known Vulnerabilities](https://snyk.io/test/github/web2solutions/Jumentix/badge.svg)](https://snyk.io/test/github/web2solutions/Jumentix) ![codesize](https://img.shields.io/github/languages/code-size/web2solutions/JumentiX
) ![activity](https://img.shields.io/github/commit-activity/y/web2solutions/Jumentix) ![last commit](https://img.shields.io/github/last-commit/web2solutions/JumentiX) ![issues](https://img.shields.io/github/issues-closed/web2solutions/Jumentix) ![issues](https://img.shields.io/github/issues/web2solutions/Jumentix)
 ![pr](https://img.shields.io/github/issues-pr-closed/web2solutions/Jumentix)
![license](https://img.shields.io/github/license/web2solutions/Jumentix) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/1d1e51b8918c44c78d129b2f697f62b9)](https://www.codacy.com/gh/web2solutions/Jumentix/dashboard?utm_source=github.com&utm_medium=referral&utm_content=web2solutions/Jumentix&utm_campaign=Badge_Grade)









### Pre requisites

- [MongoDB](https://www.mongodb.com/try/download/community)
- [RabbitMQ](https://www.rabbitmq.com/download.html) and [RabbitMQ - Management plugin](https://www.rabbitmq.com/management.html) 
- [Redis](https://redis.io/download)
- [Node.js 10, 11](https://nodejs.org/pt-br/download/releases/)
- [Elastic](https://www.elastic.co/) **_optional_**
- [Apache Cassandra](https://cassandra.apache.org/) **_optional_**
- [Apache Kafka](https://kafka.apache.org/) **_optional_**
- PostgreSQL, MySQL, SQL Server **_optional_**

**Notes**

In order to use Node 12 or greater, need to update gulp.

## How to install

```
    $ cd /home/apps
```

```
    $ git clone https://github.com/web2solutions/Jumentix.git
```

```
    $ cd Jumentix
```

```
    $ npm install
```

```
    $ npm start
```

### Setup new RabbitMQ account for production


> Rabbitmq provides a "guest" account when it  is setup.
> Do not use use "guest" account in production.
> Change it on mq configuration and a related new account to rabbitmq

[mq configuration](https://github.com/web2solutions/Jumentix/blob/master/src/config/mq.js)

You migh use the `Management Plugin`, or the terminal:

Create account:

```
rabbitmqctl add_user ACCOUNTNAMEGOESHERE YOURPASSWORDGOESHERE

```

Set admnistrator tag
```
rabbitmqctl set_user_tags ACCOUNTNAMEGOESHERE administrator

```

Set read / write permission to all resources
```
rabbitmqctl set_permissions -p / ACCOUNTNAMEGOESHERE ".\*" ".\*" ".\*"
```




### How to see JumentiX and JumentiX Vue UI in action

1. Install [JumentiX](https://github.com/web2solutions/Jumentix#pre-requisites)

```bash
# install dependencies
npm install

# serve with hot reload at localhost:3001
npm start
``` 


2. Install [JumentiX Vue UI](https://github.com/web2solutions/Jumentix-Vue-UI#project-structure)

```bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev
``` 

3. Reach and Setup the REST API on browser: 

[http://localhost:3001/application/setup](http://localhost:3001/application/setup)


4. Reach UI on browser: 

[http://localhost:8080/](http://localhost:8080/)


5. Do login.

User: admin@admin.com
Password: 123

It is going to ask you to change your password.

6. Swagger based CRUD screen - JQWidget implementation


[http://localhost:8080/#/human](http://localhost:8080/#/human)


7. Swagger based CRUD screen - Vuetify implementation


[http://localhost:8080/#/surveys](http://localhost:8080/#/surveys)





### Testing

#### Build mode

    $ npm run test

#### Dev mode

1 - `Start the application`

    $ npm start

2 - `Run  test suite`

    $ npm run _test


### Commands

#### Start app on development mode

    $ npm start


#### Stop app

    $ npm run start


#### Run ESlint fixing code

    $ npm run eslint-fix

#### Run ESlint to check code issues

    $ npm run lint


#### Build code to production

    $ npm run build

#### Run app on dev mode using nodemon

    $ npm run nodemon


#### Run app on dev mode as cluster

    $ npm run dev-cluster

#### Run app on dev mode as single fork

    $ npm run dev-simple


#### Deploy to production Git + SSH

    $ npm run deploy-production


#### Deploy to test Git + SSH

    $ npm run deploy-test



#### Build app and run on simple single thread

    $ npm run simple


#### Build app and run on simple single thread

    $ npm run cluster



#### pm2 Update

    $ npm run update


#### Setup Sequelize migrations

    $ npm run update
