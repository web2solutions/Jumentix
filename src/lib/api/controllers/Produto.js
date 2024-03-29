import * as fs from 'fs'

import { accepted, created, errorResponse, result } from '../../response'
import { copy, uuid } from '../../util'

import RabbitEnvelop from '../../RabbitEnvelop'
import multer from 'multer'
import path from 'path'
import { promisify } from 'util'

const writeFileAsync = promisify(fs.writeFile)

const entity = 'Produto'
const queue = `JumentiX.${entity}`
const primaryKeyName = '_id'

// CRITICAL MOVE TO SERVICE LAYER fs.existsSync(app.cdnDIR + entity) || fs.mkdirSync(app.cdnDIR + entity)

/**
    Add sub document
*/
export async function AddSubDocument (req, res, next) {
  const _id = req.swagger.params.id.value
  const field = req.swagger.params.field.value

  // document.createdBy = req.user.userId

  // let payload = { _id, document: req.body, subCollectionName: field };

  try {
    const // set Service Procedure name
      action = 'add_sub_document'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = { _id, document: req.body, subCollectionName: field }
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    Add sub document
*/
export async function EditSubDocument (req, res, next) {
  const _id = req.swagger.params.id.value
  const field = req.swagger.params.field.value

  // document.createdBy = req.user.userId

  // let payload = { _id, document: req.body, subCollectionName: field };

  try {
    const // set Service Procedure name
      action = 'edit_sub_document'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = { _id, document: req.body, subCollectionName: field }
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    Add sub document
*/
export async function DeleteSubDocument (req, res, next) {
  const _id = req.swagger.params.id.value
  const field = req.swagger.params.field.value

  // document.createdBy = req.user.userId

  // let payload = { _id, document: req.body, subCollectionName: field };

  try {
    const // set Service Procedure name
      action = 'delete_sub_document'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = { _id, document: req.body, subCollectionName: field }
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    List Entities by consuming it service layer
*/
export async function list (req, res) {
  // console.log(req.application.mapperRPC);
  try {
    const // set Service Procedure name
      action = 'getAll'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = req.swagger.params
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // console.error('>>>>>>>>>>>>>>>>>>', app)
    console.error('>>>>>>>>>>>>>>>>>>', req.application)
    // respond job result
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    Read an entity by consuming it service layer
*/
export async function read (req, res) {
  try {
    const // set Service Procedure name
      action = 'getById'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = {
      [primaryKeyName]: req.swagger.params.id.value
    }
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond job result
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

// ------------WRITE SYNC METHODS-------------------------------

/**
    Create an entity by consuming it service layer
*/
export async function create (req, res) {
  try {
    const // set Service Procedure name
      action = 'create'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = req.body
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return created(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    Register user
*/
export async function register (req, res) {
  try {
    const // set Service Procedure name
      action = 'register'
    // set who asked for the job
    const from = req.application.getServerUser()
    // set payload to execute the job
    const payload = req.body
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return created(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    Update an entity by consuming it service layer
*/
export async function update (req, res) {
  try {
    const // set Service Procedure name
      action = 'update'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = copy(req.body, {
      [primaryKeyName]: req.swagger.params.id.value
    })
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    Delete an entity by consuming it service layer
*/
export async function destroy (req, res) {
  let action = 'delete'
  if (req.swagger.params.mode) {
    if (req.swagger.params.mode.value === 'hard') {
      action = 'delete_hard'
    }
  }
  try {
    const // set who asked for the job
      from = req.user
    // set payload to execute the job
    const payload = {
      [primaryKeyName]: req.swagger.params.id.value
    }
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

export async function restore (req, res) {
  try {
    const // set Service Procedure name
      action = 'restore'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = {
      [primaryKeyName]: req.swagger.params.id.value
    }
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

function _Upload (req, res, next) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        console.log('destination')
        cb(null, path.resolve(req.application.cdnDIR + entity))
      },
      filename: function (req, file, cb) {
        console.log('filename')
        cb(null, file.originalname)
      }
    })
  }).single('file')
  return new Promise(function (resolve, reject) {
    upload(req, res, async function (error) {
      // console.log(arguments)
      if (error) {
        console.log(error)
        resolve({
          data: false,
          error: error,
          status: 500
        })
      } else {
        // console.log('File uploaded successfully.',  req.files);
        // console.log(req.files)
        const nameArray = req.files.file.name.split('.')
        const typeArray = req.files.file.mimetype.split('/')
        const typeOfFile = typeArray[0]
        const fileExtension = nameArray[nameArray.length - 1]
        const finalFileName = `${typeOfFile}_${req.user.userId ||
          uuid()}_${uuid()}.${fileExtension}`

        fs.existsSync(path.resolve(req.application.cdnDIR + entity)) ||
          fs.mkdirSync(path.resolve(req.application.cdnDIR + entity))
        const ioResult = await writeFileAsync(
          `${path.resolve(req.application.cdnDIR + entity)}/${finalFileName}`,
          req.files.file.data,
          'binary'
        )
        let resp = JSON.parse(JSON.stringify(req.files))
        resp.file.name = finalFileName
        resp.file.path = `${path.resolve(
          req.application.cdnDIR + entity
        )}/${finalFileName}`

        delete resp.data
        resp = JSON.parse(JSON.stringify(resp))
        resolve({
          data: resp,
          error: ioResult,
          status: 200
        })
      }
    })
  })
}

/**
    Upload files to an entity by consuming it service layer
*/
export async function Upload (req, res, next) {
  const fileDocId = req.body._id
  const label = req.body.label
  const memo = req.body.memo
  const { error, data } = await _Upload(req, res, next)
  // console.log({ error, data })
  const entityId = req.swagger.params.id.value
  const fileDocument = JSON.parse(JSON.stringify(data))
  // console.log(fileDocument)
  delete fileDocument.file.data
  delete fileDocument.file.truncated
  delete fileDocument.file.encoding
  fileDocument.file._id = fileDocId
  fileDocument.file.label = label
  fileDocument.file.file = fileDocument.file.name
  fileDocument.file.memo = memo
  fileDocument.file.createdBy = req.user.human._id
  // console.log(fileDocument)
  try {
    const // set Service Procedure name
      action = 'add_file'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = copy(fileDocument, { [primaryKeyName]: entityId })
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // execute the job
    const response = await req.application.mapperRPC.services[entity][action](
      job
    )

    // check if is there a error executing the job
    if (response.error) {
      return errorResponse(res, response, response.status)
    }
    // respond
    return result(res, response)
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}
// ------------WRITE SYNC METHODS-------------------------------

// ------------WRITE ASYNC METHODS-------------------------------
/**
    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    Following WRITE operations are performed by sending messages to Entity's queue
    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
*/

/**
    Create an entity by sending a message to it queue.
*/
export async function createAsync (req, res) {
  try {
    const // set Service Procedure name
      action = 'create'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = req.body
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // set job message
    const message =
      'Your request is being processed and you be notified coming soon.'
    // set message to Entity's queue
    const { sent, error, status } = req.application.sender.send.messageToQueue(
      queue,
      job
    )

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message: error.message }, status)
    }
    // respond
    return accepted(res, { data: job, message })
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    Update an entity by sending a message to it queue.
*/
export async function updateAsync (req, res) {
  try {
    const // set Service Procedure name
      action = 'update'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = copy(req.body, {
      [primaryKeyName]: req.swagger.params.id.value
    })
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // set job message
    const message =
      'Your request is being processed and you be notified coming soon.'
    // set message to Entity's queue
    const { sent, error, status } = req.application.sender.send.messageToQueue(
      queue,
      job
    )

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message: error.message }, status)
    }
    // respond
    return accepted(res, { data: job, message })
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}

/**
    Delete an entity by sending a message to it queue.
*/
export async function destroyAsync (req, res) {
  try {
    const // set Service Procedure name
      action = 'delete'
    // set who asked for the job
    const from = req.user
    // set payload to execute the job
    const payload = {
      [primaryKeyName]: req.swagger.params.id.value
    }
    // create a job request message
    const job = new RabbitEnvelop({ from, entity, action, payload })
    // set job message
    const message =
      'Your request is being processed and you be notified coming soon.'
    // set message to Entity's queue
    const { sent, error, status } = req.application.sender.send.messageToQueue(
      queue,
      job
    )

    // check if is there a error executing the job
    if (error) {
      return errorResponse(res, { error, message: error.message }, status)
    }
    // respond
    return accepted(res, { data: job, message })
  } catch (error) {
    return errorResponse(res, {
      error,
      message: error.message || error,
      status: 500
    })
  }
}
