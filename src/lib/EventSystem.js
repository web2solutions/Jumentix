'use strict'

import { uuid } from './util'

class EventSystem {
  constructor () {
    this.eventBus = []
  }

  on (name, handler) {
    const id = uuid()
    if (typeof name !== 'string') {
      throw Error('Event name must be a string')
    }
    this.eventBus.push({
      name,
      handler,
      id
    })
    return id
  }

  triggerEvent (eventName, eventObject) {
    eventObject = eventObject || {}
    // console.log('trigger ', eventName)
    this.eventBus.forEach(event => {
      // //console.log( event.name, eventName )
      // //console.log( event.name === eventName )
      if (event.name === eventName) {
        // console.log('trigger ',  eventName)
        eventObject.eventName = eventName
        if (event.handler) {
          event.handler = event.handler.bind(this)
          event.handler(eventObject)
        }
      }
    })
  }

  destroyEvent (eventId) {
    console.log('Mediator.destroyEvent', eventId)
    let removed = false
    for (let x = 0; x < this.eventBus.length; x++) {
      const event = this.eventBus[x]
      // console.log(event.id);
      if (event.id === eventId) {
        console.log('eventId', eventId)
        this.eventBus.splice(x, 1)
        removed = true
      }
    }

    return removed
  }
}

export default EventSystem
