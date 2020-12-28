#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Swagger routes.

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------


In a Swagger based API, the HTTP server resources (URL - /api/DemoUser) and it methods (GET, PUT, DEL, POST, PATCH) are defined under a human friendly contract format which follows the [Open API Specification Standards](https://swagger.io/resources/open-api/).


### The Swagger route specifications defines:

1. All methods and it resources, example:

- GET api/DemoUser - List all DemoUsers
- POST api/DemoUser - Create new DemoUser
- GET api/DemoUser/{id} - Reads specific DemoUser data
- PUT api/DemoUser/{id} - Updates specific DemoUser data
- DEL api/DemoUser/{id} - Deletes specific DemoUser


Please consider the following routes specification file: `./src/lib/api/swagger/DemoUser.swagger.yaml`

```yaml
/api/DemoUser:
  x-swagger-router-controller: DemoUser
# list
  get:
    operationId: list
    produces:
      - "application/json"
    consumes:
      - "application/json"
    security:
      - Bearer: []
    x-security-scopes:
      - admin
      - user
    tags:
      - DemoUser
    summary: Get the list of DemoUsers
    description: Get the list of DemoUsers
    parameters:
      - name: "offset"
        description: "Number of instances/rows to skip"
        in: query
        type: integer
        required: false
        default: 0
      - name: "limit"
        description: "Number of instances/rows to fetch"
        in: query
        type: integer
        required: false
        default: 300
      - name: sort
        description: Sort object to list data as string
        in: query
        required: false
        type: string
      - name: filters
        description: Kendo filtering object as string
        in: query
        required: false
        type: string
      - in: query
        name: attributes
        description: Attributes to display on listing
        type: string
        required: false
        default: "_id,first_name,last_name,email,createdAt,updatedAt,_writer_id,active,deleted,_history"
        #example: "_id,first_name"
    responses:
      200:
        description: Success.
        schema:
          type: array
          items:
            $ref: "#/definitions/DemoUser_collection"
      404:
        $ref: '#/responses/404'
      500:
        $ref: '#/responses/500'
# create
  post:
    operationId: create
    produces:
      - "application/json"
    consumes:
      - "application/json"
    security:
      - Bearer: []
    x-security-scopes:
      - admin
      - user
    tags:
      - DemoUser
    summary: Create a new DemoUser
    description: Create a new DemoUser
    parameters:
      - in: body
        name: body
        required: true
        schema:
          $ref: "#/definitions/DemoUser_create"
    responses:
      201:
        description: Success.
        schema:
          $ref: "#/definitions/DemoUser_response_created"
      500:
        $ref: '#/responses/500'

/api/DemoUser/{id}:
  x-swagger-router-controller: DemoUser
# read
  get:
    operationId: read
    produces:
      - "application/json"
    consumes:
      - "application/json"
    security:
      - Bearer: []
    x-security-scopes:
      - admin
      - user
    tags:
      - DemoUser
    summary: Get a DemoUser by id
    description: Get a DemoUser by id
    parameters:
      - name: id
        description: id
        in: path
        required: true
        type: string
    responses:
      200:
        description: Success.
        schema:
          $ref: "#/definitions/DemoUser_response"
      500:
        $ref: '#/responses/500'
# update
  put:
    operationId: update
    produces:
      - "application/json"
    consumes:
      - "application/json"
    security:
      - Bearer: []
    x-security-scopes:
      - admin
      - user
    tags:
      - DemoUser
    summary: Update a DemoUser by id
    description: Update a DemoUser by id
    parameters:
      - name: id
        description: id
        in: path
        required: true
        type: string
      - in: body
        name: body
        schema:
          type: array
          $ref: "#/definitions/DemoUser"
    responses:
      200:
        description: Success.
        schema:
          $ref: "#/definitions/DemoUser_response_updated"
      500:
        $ref: '#/responses/500'
# destroy
  delete:
    operationId: destroy
    produces:
      - "application/json"
    consumes:
      - "application/json"
    security:
      - Bearer: []
    x-security-scopes:
      - admin
      - user
    tags:
      - DemoUser
    summary: Delete a DemoUser by id
    description: Delete a DemoUser by id
    parameters:
      - name: id
        description: id
        in: path
        required: true
        type: string
    responses:
      200:
        $ref: '#/responses/deleted'
      500:
        $ref: '#/responses/500'

```
