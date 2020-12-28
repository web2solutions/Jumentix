const pkg = require('./package.json'),
    env = process.env.NODE_ENV || "development";

module.exports = {
  "apps": [
    {
      "name": pkg.name,
      "script": "./dist/app.js",
      "instances": 'max',
      "exec_mode": "cluster",
      "watch": false,
      "env": {
        "NODE_ENV": env
      },
      "env_production": {
        "NODE_ENV": "production"
      }
    }
  ]
}
