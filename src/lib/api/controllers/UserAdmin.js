import { result, notFound, errorResponse, accepted } from '../../response'
import RabbitEnvelop from '../../RabbitEnvelop'
import app from '../../../app'
import { copy } from '../../util'

const entity = 'User',
  queue = `JumentiX.${entity}`,
  primaryKeyName = '_id'

// Read a user
export async function read(req, res) {
  try {
    const // set Service Procedure name
      action = 'getOne',
      // set who asked for the job
      from = req.user,
      // set payload to execute the job
      payload = {
        username: req.swagger.params.username.value
      },
      // create a job request message
      job = new RabbitEnvelop({ from, entity, action, payload }),
      // execute the job
      { error, data, status } = await app.mapperRPC.services[entity][action](
        job
      ),
      // set job message
      message = (error.message || error, action + ' ' + entity)

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message }, status)
    }
    // respond job result
    return result(res, { data, message })
  } catch (error) {
    return errorResponse(res, { error, message: error.message })
  }
}

// Get current user
export async function me(req, res) {
  const user = req.user
  delete user.session.id
  return result(res, { data: user })
}

/*
 * Administrator
 */

// List of user's
export async function listAdmin(req, res) {
  try {
    const // set Service Procedure name
      action = 'getAll',
      // set who asked for the job
      from = req.user,
      // create a job request message
      job = new RabbitEnvelop({ from, entity, action }),
      // execute the job
      {
        error,
        data,
        status,
        count,
        pages,
        limit,
        page,
        isCache
      } = await app.mapperRPC.services[entity][action](job),
      // set job message
      message = (error.message || error, action + ' ' + entity)

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message }, status)
    }
    // respond job result
    return result(res, { data, count, pages, limit, page, message, isCache })
  } catch (error) {
    return errorResponse(res, { error, message: error.message })
  }
}

/**
    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    Following WRITE operations are performed by sending messages to Entity's queue
    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
*/

// Create a user
export async function create(req, res) {
  try {
    const // set Service Procedure name
      action = 'create',
      // set who asked for the job
      from = req.user,
      // set payload to execute the job
      payload = req.body,
      // create a job request message
      job = new RabbitEnvelop({ from, entity, action, payload }),
      // set job message
      message =
        'Your request is being processed and you be notified coming soon.',
      // set message to Entity's queue
      { sent, error, status } = app.sender.send.messageToQueue(queue, job)

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message: error.message }, status)
    }
    // respond
    return accepted(res, { data: job, message })
  } catch (error) {
    return errorResponse(res, { error, message: error.message })
  }
}

// Update user
export async function update(req, res) {
  try {
    const // set Service Procedure name
      action = 'update',
      // set who asked for the job
      from = req.user,
      // set payload to execute the job
      payload = copy(req.body, { [primaryKeyName]: req.user._id }),
      // create a job request message
      job = new RabbitEnvelop({ from, entity, action, payload }),
      // set job message
      message =
        'Your request is being processed and you be notified coming soon.',
      // set message to Entity's queue
      { sent, error, status } = app.sender.send.messageToQueue(queue, job)

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message: error.message }, status)
    }
    // respond
    return accepted(res, { data: job, message })
  } catch (error) {
    return errorResponse(res, { error, message: error.message })
  }
}

// Update a user
export async function updateAdmin(req, res) {
  try {
    const // set Service Procedure name
      action = 'update',
      // set who asked for the job
      from = req.user,
      // set payload to execute the job
      payload = copy(req.body, {
        [primaryKeyName]: req.swagger.params.id.value
      }),
      // create a job request message
      job = new RabbitEnvelop({ from, entity, action, payload }),
      // set job message
      message =
        'Your request is being processed and you be notified coming soon.',
      // set message to Entity's queue
      { sent, error, status } = app.sender.send.messageToQueue(queue, job)

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message: error.message }, status)
    }
    // respond
    return accepted(res, { data: job, message })
  } catch (error) {
    return errorResponse(res, { error, message: error.message })
  }
}

// Destroy a user
export async function destroyAdmin(req, res, next) {
  try {
    const // set Service Procedure name
      action = 'delete',
      // set who asked for the job
      from = req.user,
      // set payload to execute the job
      payload = {
        [primaryKeyName]: req.swagger.params.id.value
      },
      // create a job request message
      job = new RabbitEnvelop({ from, entity, action, payload }),
      // set job message
      message =
        'Your request is being processed and you be notified coming soon.',
      // set message to Entity's queue
      { sent, error, status } = app.sender.send.messageToQueue(queue, job)

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message: error.message }, status)
    }
    // respond
    return accepted(res, { data: job, message })
  } catch (error) {
    return errorResponse(res, { error, message: error.message })
  }
}
