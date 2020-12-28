#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a>  Swagger definitions.

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------


In a Swagger based API, the HTTP server responses and all it related data, strictly follow a contract which defines it formats.


### The Swagger definition specifications defines:

1. How every Data Entities behave.
2. Request definitions

- URL parameters
- Request body parameters
- Request headers

3. Response definitions

- Response status number
- Response message
- Response data (Unit or collection of data entities)


Please consider the following routes specification file: `./src/lib/api/swagger/definitions/DemoUser.definition.yaml`

```yaml
definitions:
  # Object used when listing one item
  DemoUser_response:
    properties:
      code:
        type: "integer"
        format: "int32"
        example: 200
      message:
        type: "string"
        example: "successful operation"
      data:
        type: "object"
        $ref: "#/definitions/DemoUser"
  # Object used when listing multiple items
  DemoUser_collection:
    properties:
      code:
        type: "integer"
        format: "int32"
        example: 200
      message:
        type: "string"
        example: "successful operation"
      data:
        type: "array"
        items:
          $ref: "#/definitions/DemoUser"
  # Object used when creating an item
  DemoUser_response_created:
    properties:
      code:
        type: "integer"
        format: "int32"
        example: 201
      message:
        type: "string"
        example: "Created"
      id:
        type: "string"
        example: 5c0fb100ec2339ed5bea6303
      data:
        $ref: "#/definitions/DemoUser"
  # Object used when creating an item
  DemoUser_response_updated:
    properties:
      code:
        type: "integer"
        format: "int32"
        example: 200
      message:
        type: "string"
        example: "successful operation"
      id:
        type: "string"
        example: 5c0fb100ec2339ed5bea6303
      data:
        $ref: "#/definitions/DemoUser"
  DemoUser:
    properties:
      _id:
        type: "string"
      email:
        type: "string"
      first_name:
        type: "string"
      last_name:
        type: "string"
  DemoUser_create:
    required: ["email","first_name","last_name"]
    properties:
      email:
        type: "string"
      first_name:
        type: "string"
      last_name:
        type: "string"

```
