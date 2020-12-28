#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Code Automation

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------


This framework provides several built in `code automation` tools:

- install application and it dependencies
- Compile ES6 code into ES5
- Eslint
- Run application in dev mode
- Run application in cluster mode
- Run test suite

Commands:

> - `$ npm install`
> Installs application and it dependencies
>
> - `$ npm run start`
> Starts application under dev model using pm2-dev
>
> - `$ npm run nodemon`
> Starts application under dev model using nodemon
>
> - `$ npm run build`
> Lint application code and Compiles application ES6 version (src/ folder) into ES5 version (dist/ folder)
>
> - `$ npm run _test`
> Runs test suite agains Application running under dev mode. Please run `npm run start` before.
>
> - `$ npm run test`
> Builds application ES5 version, start it using pm2 and test it compiled version
>
> - `$ npm run lint`
> Lint application code
>
> - `$ npm run setup-sequelize`
> Run sequelize migration scripts
>
