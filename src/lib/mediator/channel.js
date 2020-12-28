'use strict'

import { uuid, isDefined, isNumber, isArray, isEmail } from '../util'

class $channel {
  constructor(c) {
    if (!isDefined(c.name)) {
      throw 'can not create channel object: undefined c.name'
    }
    if (!isDefined(c.type)) {
      throw 'can not create channel object: undefined c.type'
    }
    if (!isDefined(c.people)) {
      throw 'can not create channel object: undefined c.people'
    }
    if (!Array.isArray(c.people)) {
      throw 'can not create channel object: c.people is not array'
    }

    c.messages = c.messages || []

    this.uuid = uuid()
    this.name = c.name
    this.type = c.type // 'talk', personal, group
    this.people = []
    for (let x = 0; x < c.people.length; x++) {
      let p = c.people[x]
      // console.log( "###########  p ", p )
      delete p.browser
      this.people.push(p)
    }
    this.messages = []

    for (let x = 0; x < c.messages.length; x++) {
      let p = c.messages[x]
      // console.log( "###########  p ", p )
      delete p.browser
      this.messages.push(p)
    }
  }
}

export default $channel
