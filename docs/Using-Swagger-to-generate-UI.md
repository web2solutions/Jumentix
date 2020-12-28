#   <a href="https://web2solutions.github.io/Jumentix/"><img src="https://avatars3.githubusercontent.com/u/14809007?s=280&v=4" width="50" /></a> Using Swagger to generate UIs

[Back to Documentation main page](https://web2solutions.github.io/Jumentix/)

--------------------------

Swagger and Open Data specification is common used to generate REST API end points and it related stuffs like data input and output validation.

Most pieces of large enterprise applications are based on CRUD screens (Create, Read, Update Delete).

Irrespective of format or the "User Experience", at certain level, the FrontEnd, or application client, must match the Back End standards.

The main idea is to extend the Open Data specification and then to use it as metadata to automatically generate Front End CRUD screens.



---------------------

***TODO***


## Using Swagger to build User Interfaces



### Text Field

```yaml
    first_name:
        description: "First Name"
        type: "string"
        example: "Thomas"
        minLength: 2
        x-ui:
          grid:
            hide: false
            label: First name
            width:  "120"
          form:
            hide: false
            label: First name
```

### ComboBox field linked to another collection

```yaml
    user:
        description: "System Account associated to this Human"
        type: "string"
        example: "5c78a060c15bca840749e44b"
        x-ui:
          collection-link: User
          collection-link-value: _id
          collection-link-label: username
          grid:
            hide: false
            label: User
            width:  "120"
          form:
            type: combobox # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete
            hide: false
            label: User
            selection-limit: 1
```

### Select field linked to another collection

```yaml
    user:
        description: "System Account associated to this Human"
        type: "string"
        example: "5c78a060c15bca840749e44b"
        x-ui:
          collection-link: User
          collection-link-value: _id
          collection-link-label: username
          grid:
            hide: false
            label: User
            width:  "120"
          form:
            type: select # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete
            hide: false
            label: User
            selection-limit: 1
```

### Select field listing form defined options

```yaml
    roles:
        type: "array"
        description: The User's role
        default: ["parent"]
        items:
          type: "string"
        x-ui:
          grid:
            hide: false
            label: User's role
            width:  120
          form:
            type: select # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete
            hide: false
            label: User's role
            options: ["admin", "staff", "parent", "child", "agency", "caseworker", "manager"]
            selection-limit: 0
```


### Select field listing enum values

```yaml
    role:
        type: "string"
        enum: ["admin", "staff", "parent", "child", "agency", "caseworker", "manager"]
        description: The User's role
        default: ["parent"]
        items:
          type: "string"
        x-ui:
          grid:
            hide: false
            label: User's role
            width:  120
          form:
            type: select # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete
            hide: false
            label: User's role
            selection-limit: 0
```

### Multi select / listing field linked to a collection

```yaml
    sub_roles:
        type: "array"
        description: Sub Roles allowed in this Program
        default: []
        items:
          type: "string"
        x-ui:
          collection-link: SubRole
          collection-link-value: _id
          collection-link-label: label
          grid:
            hide: false
            label: Sub Roles
            width:  "17%"
          form:
            type: multipleselect # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete
            hide: false
            label: Sub Roles
            selection-limit: 0
```


### Dependent fields linked to a collection

```yaml
    role:
        type: "string"
        description: "Role  allowed in this Program"
        example: "5c78a060c15bca840749e44b"
        x-ui:
          collection-link: Role
          collection-link-value: _id
          collection-link-label: label
          dependent:
            - targetField: sub_roles
              remoteKey: role
              localKey: _id
          grid:
            hide: false
            label: Role
            width: "83%"
          form:
            type: combo # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete, date, time, grid
            hide: false
            label: Role
            selection-limit: 1
    sub_roles:
        type: "array"
        description: Sub Roles allowed in this Program
        default: []
        items:
          type: "string"
        x-ui:
          collection-link: SubRole
          collection-link-value: _id
          collection-link-label: label
          dependentOf: role
          grid:
            hide: false
            label: Sub Roles
            width:  "17%" # take 20% considering the altrow indicator
          form:
            type: multipleselect # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete
            hide: false
            label: Sub Roles
            selection-limit: 0
```

### Date-Time Field

```yaml
    createdAt:
        description: "Created At"
        type: "string"
        format: "date-time"
        example: "2017-07-21"
        x-ui:
          grid:
            hide: false
            label: Created At
            width:  120
          form:
            type: date-time # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete, date, time, date-time
            hide: false
            label: Created At
```

### Date field

```yaml
    birthDate:
        description: "Birth Date"
        type: "string"
        format: "date"
        #nullable: true
        example: "2017-07-21"
        x-ui:
          grid:
            hide: true
            label: Birth Date
            width:  "120"
          form:
            type: date # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete, date, time
            hide: false
            label: Birth Date
```

### Formated/Validated SSN field

```yaml
    ssn:
        description: "Social Security Number"
        type: "string"
        format: ssn
        example: "000-00-0000"
        x-ui:
          grid:
            hide: false
            label: SSN
            width:  "100"
          form:
            hide: false
            label: SSN
```

### Avatar field

```yaml
    avatar:
        description: "Avatar - It can be the path of a file on CDN or a base64 encoded file. If you provide a base64 image hash it will be saved as file on CDN."
        type: "string"
        format: "base64"
        example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/sdf........"
        x-ui:
          grid:
            hide: true
            label: Avatar
            width:  "*"
          form:
            type: base64
            hide: false
            label: Avatar
            accept: "image/png, image/jpeg"
            file-size: 0.5
            media-type: avatar # avatar, image, document
```

### Single file field

```yaml
    signature:
        description: "Signature - It can be the path of a file on CDN or a base64 encoded file. If you provide a base64 image hash it will be saved as file on CDN."
        type: "string"
        format: "base64"
        example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/sdf........"
        x-ui:
          grid:
            hide: true
            label: Signature
            width:  "120"
          form:
            type: base64
            hide: false
            label: Signature
            accept: "image/png, image/jpeg"
            file-size: 4
            media-type: image # avatar, image, document
```

### Muliple file field

```yaml
    file:
        description: "File attachments"
        type: "array"
        items:
          $ref: "#/definitions/file"
        #default: []
        x-uploader: true
        x-ui:
          grid:
            hide: true
            label: Files
            width:  "*"
          form:
            type: grid # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete, date, time, grid
            hide: false
            label: Files
            isSchema: true
```

### Multidimensional field / Grid linked to a schema

```yaml
    address:
        description: "Addresses"
        type: "array"
        items:
          $ref: "#/definitions/address"
        default: []
        x-ui:
          grid:
            hide: true
            label: Address
            width:  "120"
          form:
            type: grid # select, combobox, text,  radio, checkbox, switch, textarea, autocomplete, date, time, grid
            hide: false
            label: Address
            isSchema: true
```

### Integer field

```yaml
    size:
        description: 'File size'
        type: "integer"
        format: "int32"
        example: 12300
        readOnly: true
        x-editable: false
        x-ui:
          grid:
            hide: false
            label: File Size
            width:  100
          form:
            hide: true
            label: File Size
```

### x-ui available properties:

- `collection-link`

Sets the collection name which will be used to pull data from

- `collection-link-value`

Sets the collection property which will be used as value on Selection/Multi Selection fields

- `collection-link-label`

Sets the collection property which will be used as label on Selection/Multi Selection fields


- `form`

Sets how a property behaves on a form -> Form Field

- `grid`

Sets how a property behaves on a grid -> Grid Column


### form available properties:

- `type`
- `hide`
- `label`
- `isSchema`
- ``
