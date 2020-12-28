const pkg = require('./package.json'),
    env = process.env.NODE_ENV || "development";

module.exports = {
    "apps" : [
        {
            "name" : pkg.name + "-simple",
            "script" : "./dist/app.js",
            //"cwd": "/home/apiuser/JumentiX-Rest-API-Central-Auth/",
            "instances" : '1',
            "exec_mode" : "cluster",
            "watch" : false,
            "env" :
            {
                "NODE_ENV" : env
            },
            "env_production" :
            {
                "NODE_ENV" : "production"
            }
        }
    ]
}
