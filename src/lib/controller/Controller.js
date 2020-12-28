'use strict'
import { result, errorResponse, accepted, created } from '../response'
import RabbitEnvelop from '../RabbitEnvelop'
import app from '../../app'
import { copy, uuid } from '../util'
import multer from 'multer'
import * as fs from 'fs'
import { promisify } from 'util'
import path from 'path'
import Service from '../Job/Service'
const writeFileAsync = promisify(fs.writeFile)

/**
 * HTTP Controller main Class
 * @class
 */
class Controller extends Service {
  /**
   * Creates generic Entity Controller
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor(c) {
    super(app)
    let self = this
    this.application = app
    this.entity = c.entity
    this.isAsync = false // default false
    this.queue = `JumentiX.${this.entity}`

    fs.existsSync(this.application.cdnDIR + this.entity) ||
      fs.mkdirSync(this.application.cdnDIR + this.entity)
    // console.log(this)

    this.storage = multer.diskStorage({
      destination: function (req, file, cb) {
        console.log('destination')
        cb(null, path.resolve(self.application.cdnDIR + self.entity))
      },
      filename: function (req, file, cb) {
        console.log('filename')
        cb(null, file.originalname)
      }
    })

    self.upload = multer({
      storage: self.storage
    }).single('file')
  }

  /**
        List Entities by consuming it service layer
    */
  async list(req, res) {
    let self = this
    // console.log(self, this)
    try {
      const // set Service Procedure name
        action = 'getAll',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = req.swagger.params,
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
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
        } = await self.application.mapperRPC.services[self.entity][action](
          job
        ),
        // set job message
        message = (error.message || error, action + ' ' + self.entity)

      // check if is there a error executing the job
      if (error) {
        return errorResponse(res, { error, message }, status)
      }
      // respond job result
      console.log(data)
      return result(res, { data, count, pages, limit, page, message, isCache })
    } catch (error) {
      console.log(error)
      return errorResponse(res, { error, message: error.message })
    }
  }

  /**
        Read an self.entity by consuming it service layer
    */
  async read(req, res) {
    try {
      let self = this
      const // set Service Procedure name
        action = 'getById',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = {
          [self.primaryKeyName]: req.swagger.params.id.value
        },
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // execute the job
        { error, data, status } = await self.application.mapperRPC.services[
          self.entity
        ][action](job),
        // set job message
        message = (error.message || error, action + ' ' + self.entity)

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

  // ------------WRITE SYNC METHODS-------------------------------

  /**
        Create an self.entity by consuming it service layer
    */
  async create(req, res) {
    try {
      let self = this
      const // set Service Procedure name
        action = 'create',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = req.body,
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // execute the job
        { error, data, status } = await self.application.mapperRPC.services[
          self.entity
        ][action](job),
        // set job message
        message = (error.message || error, action + ' ' + self.entity)

      // check if is there a error executing the job
      if (error) {
        return errorResponse(
          res,
          { error, message: error.message || error },
          status
        )
      }
      // respond
      return created(res, { data: data, message })
    } catch (error) {
      return errorResponse(res, { error, message: error.message })
    }
  }

  /**
        Update an self.entity by consuming it service layer
    */
  async update(req, res) {
    try {
      let self = this
      const // set Service Procedure name
        action = 'update',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = copy(req.body, {
          [self.primaryKeyName]: req.swagger.params.id.value
        }),
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // execute the job
        { error, data, status } = await self.application.mapperRPC.services[
          self.entity
        ][action](job),
        // set job message
        message = (error.message || error, action + ' ' + self.entity)

      // check if is there a error executing the job
      if (error) {
        return errorResponse(
          res,
          { error, message: error.message || error },
          status
        )
      }
      // respond
      return result(res, { data, message })
    } catch (error) {
      return errorResponse(res, { error, message: error.message })
    }
  }

  /**
        Delete an self.entity by consuming it service layer
    */
  async destroy(req, res) {
    let action = 'delete'
    if (req.swagger.params.mode) {
      if (req.swagger.params.mode.value === 'hard') {
        action = 'delete_hard'
      }
    }

    try {
      let self = this
      const // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = {
          [self.primaryKeyName]: req.swagger.params.id.value
        },
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // execute the job
        { error, data, status } = await self.application.mapperRPC.services[
          self.entity
        ][action](job),
        // set job message
        message = (error.message || error, action + ' ' + self.entity)

      // check if is there a error executing the job
      if (error) {
        return errorResponse(
          res,
          { error, message: error.message || error },
          status
        )
      }
      // respond
      return result(res, { data, message })
    } catch (error) {
      return errorResponse(res, { error, message: error.message })
    }
  }

  async restore(req, res) {
    try {
      let self = this
      const // set Service Procedure name
        action = 'restore',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = {
          [self.primaryKeyName]: req.swagger.params.id.value
        },
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // execute the job
        { error, data, status } = await self.application.mapperRPC.services[
          self.entity
        ][action](job),
        // set job message
        message = (error.message || error, action + ' ' + self.entity)

      // check if is there a error executing the job
      if (error) {
        return errorResponse(
          res,
          { error, message: error.message || error },
          status
        )
      }
      // respond
      return result(res, { data, message })
    } catch (error) {
      return errorResponse(res, { error, message: error.message })
    }
  }

  _Upload(req, res, next) {
    let self = this
    return new Promise(function (resolve, reject) {
      self.upload(req, res, async function (error) {
        // console.log(arguments)
        if (error) {
          console.log(error)
          resolve({
            data: false,
            error: error
          })
        } else {
          // console.log('File uploaded successfully.',  req.files);

          let nameArray = req.files.file.name.split('.')
          let typeArray = req.files.file.mimetype.split('/')
          let typeOfFile = typeArray[0]
          let fileExtension = nameArray[nameArray.length - 1]
          let finalFileName = `${typeOfFile}_${
            req.user.userId || uuid()
          }_${uuid()}.${fileExtension}`

          fs.existsSync(path.resolve(self.application.cdnDIR + self.entity)) ||
            fs.mkdirSync(path.resolve(self.application.cdnDIR + self.entity))
          let ioResult = await writeFileAsync(
            `${path.resolve(
              self.application.cdnDIR + self.entity
            )}/${finalFileName}`,
            req.files.file.data,
            'binary'
          )
          let resp = JSON.parse(JSON.stringify(req.files))
          resp.file.name = finalFileName
          resp.file.path = `${path.resolve(
            self.application.cdnDIR + self.entity
          )}/${finalFileName}`

          delete resp.data
          resp = JSON.parse(JSON.stringify(resp))
          resolve({
            data: resp,
            error: ioResult
          })
        }
      })
    })
  }

  /**
        Upload files to an self.entity by consuming it service layer
    */
  async Upload(req, res, next) {
    let self = this
    const fileDocId = req.body._id
    const label = req.body.label
    const memo = req.body.memo
    let { error, data } = await self._Upload(req, res, next)

    let entityId = req.swagger.params.id.value
    let fileDocument = JSON.parse(JSON.stringify(data))
    delete fileDocument.file.data
    delete fileDocument.file.truncated
    delete fileDocument.file.encoding
    fileDocument.file._id = fileDocId
    fileDocument.file.label = label
    fileDocument.file.memo = memo
    fileDocument.file.createdBy = req.user.userId

    try {
      const // set Service Procedure name
        action = 'add_file',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = copy(fileDocument, { [self.primaryKeyName]: entityId }),
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // execute the job
        { error, data, status } = await self.application.mapperRPC.services[
          self.entity
        ][action](job),
        // set job message
        message = (error.message || error, action + ' ' + self.entity)

      // check if is there a error executing the job
      if (error) {
        return errorResponse(
          res,
          { error, message: error.message || error },
          status
        )
      }
      // respond
      return result(res, { data, message })
    } catch (error) {
      return errorResponse(res, { error, message: error.message })
    }
  }

  // ------------WRITE ASYNC METHODS-------------------------------
  /**
        XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        Following WRITE operations are performed by sending messages to Entity's self.queue
        XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    */

  /**
        Create an entity by sending a message to it self.queue.
    */
  async createAsync(req, res) {
    try {
      let self = this
      const // set Service Procedure name
        action = 'create',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = req.body,
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // set job message
        message =
          'Your request is being processed and you be notified coming soon.',
        // set message to Entity's self.queue
        { sent, error, status } = self.application.sender.send.messageToQueue(
          self.queue,
          job
        )

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

  /**
        Update an entity by sending a message to it self.queue.
    */
  async updateAsync(req, res) {
    try {
      let self = this
      const // set Service Procedure name
        action = 'update',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = copy(req.body, {
          [self.primaryKeyName]: req.swagger.params.id.value
        }),
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // set job message
        message =
          'Your request is being processed and you be notified coming soon.',
        // set message to Entity's self.queue
        { sent, error, status } = self.application.sender.send.messageToQueue(
          self.queue,
          job
        )

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

  /**
        Delete an entity by sending a message to it self.queue.
    */
  async destroyAsync(req, res) {
    try {
      let self = this
      const // set Service Procedure name
        action = 'delete',
        // set who asked for the job
        from = req.user,
        // set payload to execute the job
        payload = {
          [self.primaryKeyName]: req.swagger.params.id.value
        },
        // create a job request message
        job = new RabbitEnvelop({ from, entity: self.entity, action, payload }),
        // set job message
        message =
          'Your request is being processed and you be notified coming soon.',
        // set message to Entity's self.queue
        { sent, error, status } = self.application.sender.send.messageToQueue(
          self.queue,
          job
        )

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
}

export default Controller
