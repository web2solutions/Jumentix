const pkg = require('./package.json'),
    env = process.env.NODE_ENV || "development";

module.exports = {
  "apps": [
    {
      "name": pkg.name + "-dev",
      "script": "./src/app.js",
      "watch": ["src/**/*.{js,yaml}"],
      "exec_interpreter": "babel-node",
      "env": {
        "NODE_ENV": env
      },
      "args": [
        "--color"
      ]
    }
  ]
}
