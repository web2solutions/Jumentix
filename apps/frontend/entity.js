const crypto = require('node:crypto')

class BaseEntity {
  constructor(params) {
    const { id, createdAt, updatedAt } = params
    this._id = id || crypto.randomUUID()
    this.createdAt = createdAt || new Date()
    this.updatedAt = updatedAt || new Date()
  }

  toString() {
    return JSON.stringify(this)
  }

  toJson() {
    return structuredClone(this)
  }

  createdAt() {
    return this.createdAt
  }

  updatedAt() {
    return this.updatedAt
  }
}

class UserEntity extends BaseEntity {
  #password
  constructor({ id, name, email, password, passwordHash }) {
    super({ id })
    this.name = name
    this.email = email
    this.#password = passwordHash || crypto.createHash('sha256').update(password).digest('hex')
    console.log(this.#password)
  }

  passwordCheck(password) {
    return this.#password === crypto.createHash('sha256').update(password).digest('hex')
  }
}

const user = new UserEntity({ name: 'John Doe', email: 'john.doe@example.com', password: '123456' })
console.log(user.passwordCheck('123456'))
console.log(user.toJson(), user)
