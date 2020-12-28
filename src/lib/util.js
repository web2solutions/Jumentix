import config from '../config'
// import configMQ from '../config/mq'
// import configRedis from '../config/redis'
// import configGmail from '../config/gmail'
// import configMailGun from '../config/mailgun'
import * as fs from 'fs'
import { promisify } from 'util'

const writeFileAsync = promisify(fs.writeFile)
const env = process.env.NODE_ENV || 'development'

export function validName (nickname) {
  // let regex = /^\w*$/;
  // return regex.exec(nickname) !== null;
  return typeof nickname === 'string'
}

export function copy (obj, targetObj) {
  targetObj = targetObj || {}
  for (const i in obj) {
    targetObj[i] = obj[i]
  }

  return targetObj
}

export function sanitizePayload (payloadObj, job) {
  const payload = { ...payloadObj }
  if (isDefined(payload.__v)) {
    delete payload.__v
  }

  if (isDefined(payload.deleted)) {
    delete payload.deleted
  }

  delete payload.createdBy
  delete payload.updatedBy
  return payload
}

export function gen6Digs () {
  return Math.floor(100000 + Math.random() * 900000)
}

export function randomPassword () {
  const count = 6
  const chars = 'acdefhiklmnoqrstuvwxyz0123456789'.split('')
  let result = ''
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * chars.length)
    result += chars[x]
  }
  return result
}

export function serviceErrorResponse (error) {
  return {
    error
  }
}

export function serviceResponse (error, record) {
  error = error || false
  record = record || false
  return {
    error,
    record
  }
}

export function findIndex (arr, el, value) {
  let len = arr.length

  while (len--) {
    if (arr[len][el] === value) {
      return len
    }
  }

  return -1
}

export function sanitizeString (message) {
  return message.replace(/(<([^>]+)>)/gi, '').substring(0, 35)
}

export function uuid () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function isDefined (variable) {
  return typeof variable !== 'undefined'
}

export function isNumber (n) {
  return !isNaN(parseFloat(n)) && isFinite(n)
}

export function isArray (n) {
  return Array.isArray(n)
}

export function isEmail (email) {
  const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return re.test(email)
}

export function isObject (val) {
  if (val === null) {
    return false
  }
  return typeof val === 'function' || typeof val === 'object'
}

export function comparer (a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isDate (dt) {
  return dt !== null && !isNaN(dt) && typeof dt.getDate !== 'undefined'
}

export function getPersonalRoomName (userId, companyId) {
  return 'agency_' + companyId + '_user_' + userId
}

const job_properties = [
  'uuid',
  'from',
  'to',
  'createdAt',
  'updatedAt',
  'entity',
  'action',
  'payload',
  'data',
  'success',
  'error',
  'status',
  'source'
]

export function getValidatedResource (payload, params) {
  const hash = {}
  for (const param in payload) {
    if (payload.hasOwnProperty(param)) {
      if (payload[param] !== null && payload[param] !== '') {
        if (params.indexOf(param) !== -1) {
          hash[param] = payload[param]
        }
      }
    }
  }
  return hash
}

export function validateJob (job) {
  let isJSON = false
  let totalPropertiesInContract = 0
  let totalPropertiesInJob = 0

  try {
    JSON.stringify(job)
    isJSON = true
  } catch (e) {
    // statements
    isJSON = false
  }

  if (!isJSON) {
    return false
  }

  totalPropertiesInContract = job_properties.length

  for (const p in job) {
    if (job.hasOwnProperty(p)) {
      if (job_properties.indexOf(p) > -1) {
        totalPropertiesInJob += 1
      }
    }
  }
  return totalPropertiesInJob >= totalPropertiesInContract
}

export function emailPayload (payload) {
  let isJSON = false
  try {
    JSON.stringify(payload)
    isJSON = true
  } catch (e) {
    // statements
    isJSON = false
  }

  if (!isJSON) {
    return false
  }

  if (!payload.message) {
    return false
  }

  if (!payload.subject) {
    return false
  }

  if (!payload.to) {
    return false
  }

  if (payload.message === '') {
    return false
  }

  if (payload.subject === '') {
    return false
  }

  if (payload.to === '') {
    return false
  }

  return true
}

export function mailOptions (from, to, subject, message, files, bcc = '') {
  files = files || []
  const o = {
    from: from, // sender address
    to: to, // list of receivers
    // cc:'second@domain.com',
    bcc: bcc,
    // 'h:Reply-To': 'reply2this@company.com',
    subject: subject, // Subject line
    text: message, // plain text body
    html: message, // html body
    attachments: files,
    priority: 'high'
    // attachDataUrls : true,
    // encoding
    // textEncoding: "quoted-printable"
    // messageId
  }
  if (files.length > 0) {
    o.attachDataUrls = true
  }
  // console.log(o)
  if (bcc === '') {
    delete o.bcc
  }
  if (!bcc) {
    delete o.bcc
  }
  return o
}

export function formatMessage (job, data) {
  let _message = `
        <tr>
          <td align="left" valign="top">
            <h2>Job ID:</h2>
            <p>${job.uuid}</p>
          </td>
        </tr>
        <tr>
          <td align="left" valign="top">
            <h2>Task:</h2>
            <p>${job.action} ${job.entity}</p>
          </td>
        </tr>
    `
  _message += `
        <tr>
          <td align="left" valign="top">
            <h2>Request information:</h2>
          </td>
        </tr>
        <tr>
          <td align="left" valign="top">
    `

  for (const p in job.payload) {
    _message += ` <p> <b>${p}</b>:  ${job.payload[p]}</p>`
  }

  _message += `
          </td>
        </tr>
    `

  _message += `
        <tr>
          <td align="left" valign="top">
            <h2>Job execution information:</h2>
          </td>
        </tr>
        <tr>
          <td align="left" valign="top">
    `

  for (const p in data) {
    if (typeof data[p] === 'number' || typeof data[p] === 'string') {
      _message += ` <p> <b>${p}</b>:  ${data[p]}</p>`
    }
    if (typeof data[p] === 'object') {
      _message += ` <p> <b>${p}</b>:</p>`
      _message += ' <ul>'
      for (const i in data[p]) {
        if (typeof data[p][i] === 'number' || typeof data[p][i] === 'string') {
          _message += ` <li> <b>${i}</b>: ${data[p][i]}</li>`
        }
      }
      _message += ' </ul>'
    }
  }

  _message += `
          </td>
        </tr>
    `

  return _message
}

export function encodeString (str) {
  const buf = []
  let i = null

  for (i = str.length - 1; i >= 0; i--) {
    buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''))
  }

  return buf.join('')
}

export function decodeString (str) {
  return str.replace(/&#(\d+);/g, function (match, dec) {
    return String.fromCharCode(dec)
  })
}

export async function calcUsername (model, username) {
  try {
    const { error, user } = await model.constructor.findOneByUsername(username)
    // if is there an error
    if (error) {
      return username
    }
    // if there is no user found
    if (!user) {
      return username
    }
    // if username is taken
    return username + '1'
  } catch (e) {
    console.log('calcUsername >>>>>', e)
    return username
  }
}

export function _setPagingLimit (job, limit) {
  if (isDefined(job.payload.limit)) {
    if (isNumber(job.payload.limit.value)) {
      // coming from a REST controller as swagger param
      limit = parseInt(job.payload.limit.value)
    } else if (isNumber(job.payload.limit)) {
      // coming from a worker
      limit = parseInt(job.payload.limit)
    }
  }
  return limit
}

export function _setPagingOffset (job, offset) {
  if (isDefined(job.payload.offset)) {
    if (isNumber(job.payload.offset.value)) {
      // coming from a REST controller as swagger param
      offset = parseInt(job.payload.offset.value)
    } else if (isNumber(job.payload.offset)) {
      // coming from a worker
      offset = parseInt(job.payload.offset)
    }
  }
  return offset
}

export function _setQueryPopulate (job, populate) {
  if (isDefined(job.payload.populate)) {
    if ('schema' in job.payload.populate) {
      // is swagger
      if (isDefined(job.payload.populate.value)) {
        // coming from a REST controller as swagger param
        populate = job.payload.populate.value
      }
    } else {
      if (isDefined(job.payload.populate)) {
        // coming from a worker
        populate = job.payload.populate
      }
    }
  }
  return populate
}

export function _setQuerySelect (job, select) {
  // set query select is dev provided attributes field (sequelize format)
  if (isDefined(job.payload.attributes)) {
    if ('schema' in job.payload.attributes) {
      // is swagger
      if (isDefined(job.payload.attributes.value)) {
        // coming from a REST controller as swagger param
        select = job.payload.attributes.value
          .toString()
          .replace(/ /g, '')
          .split(',')
          .join(' ')
      }
    } else {
      if (isDefined(job.payload.attributes)) {
        // coming from a worker
        select = job.payload.attributes
          .toString()
          .replace(/ /g, '')
          .split(',')
          .join(' ')
      }
    }
  }
  // set query select is dev provided attributes field (mongoose format)
  if (isDefined(job.payload.select)) {
    if ('schema' in job.payload.select) {
      // is swagger
      if (isDefined(job.payload.select.value)) {
        // coming from a REST controller as swagger param
        select = job.payload.select.value
      }
    } else {
      if (isDefined(job.payload.select)) {
        // coming from a worker
        select = job.payload.select
      }
    }
  }
  return select
}

export function _setQueryFilters (job, filters) {
  if (isDefined(job.payload.filters)) {
    if (isObject(job.payload.filters.value)) {
      // coming from a REST controller as swagger param
      filters = job.payload.filters.value
    } else if (isObject(job.payload.filters)) {
      // coming from a worker
      filters = job.payload.filters
    }
  }
  return filters
}

export function _setWhere (job) {
  let where = {}
  if (isDefined(job.payload.where)) {
    if ('schema' in job.payload.where) {
      // is swagger
      if (isDefined(job.payload.where.value)) {
        where = JSON.parse(job.payload.where.value)
      }
    } else {
      where =
        typeof job.payload.where === 'string'
          ? JSON.parse(job.payload.where)
          : job.payload.where
    }
  }
  return where
}

export function _setPipeline (job) {
  let pipeline = false
  if (isDefined(job.payload.pipeline)) {
    if ('schema' in job.payload.pipeline) {
      // is swagger
      if (isDefined(job.payload.pipeline.value)) {
        pipeline = JSON.parse(job.payload.pipeline.value)
      }
    } else {
      pipeline =
        typeof job.payload.pipeline === 'string'
          ? JSON.parse(job.payload.pipeline)
          : job.payload.pipeline
    }
  }
  return pipeline
}

export function _setPagingSort (job, sort) {
  if (isDefined(job.payload.sort)) {
    if (isDefined(job.payload.sort.value)) {
      const sortString = job.payload.sort.value
      try {
        const sortObj = JSON.parse(sortString)
        if (isObject(sortObj) || isArray(sortObj)) {
          // coming from a REST controller as swagger param
          sort = sortObj
        }
      } catch (e) {
        console.log(e)
      }
    } else if (!isDefined(job.payload.sort.path)) {
      // make sure it is not coming from swagger
      const sortString = job.payload.sort
      try {
        const sortObj = JSON.parse(sortString)
        if (isObject(sortObj) || isArray(sortObj)) {
          // coming from a REST controller as swagger param
          sort = sortObj
        }
      } catch (e) {}
    }
  }
  return sort
}

export function _setCacheKeyName (
  isCachedBasedOnUser,
  job,
  where = {},
  options = {}
) {
  let keyName = `cache_${job.companyId}_${job.from._id}_${job.entity}_${
    job.action
  }_${JSON.stringify(where)}_${JSON.stringify(options)}`
  if (!isCachedBasedOnUser) {
    keyName = `cache_${job.companyId}_${job.entity}_${
      job.action
    }_${JSON.stringify(where)}_${JSON.stringify(options)}`
  }
  return Buffer.from(keyName).toString('base64')
}

export function getNewSubDocument (payload = [], oldDocuments = []) {
  // console.log('payload', payload);
  // console.log('oldDocuments', oldDocuments);
  const newDocuments = payload.filter((g, index) => {
    let isNew = true
    // console.log('------------->', index);
    // console.log(g._id);
    if (oldDocuments.length === 0) {
      return isNew
    }
    for (let x = 0; x < oldDocuments.length; x++) {
      isNew = true
      // console.log('-->', x);
      // console.log(oldDocuments[x]._id);
      if (oldDocuments[x]._id.toString() === g._id.toString()) {
        isNew = false
        break
      }
      // console.log('isNew ', isNew);
    }
    return isNew
  })
  return newDocuments
}

export function getRemovedSubDocument (payload = [], oldDocuments = []) {
  // console.log('payload', payload);
  // console.log('oldDocuments', oldDocuments);
  const removedDocuments = oldDocuments.filter((g, index) => {
    let isRemoved = true
    // console.log('------------->', index);
    // console.log(g._id);
    for (let x = 0; x < payload.length; x++) {
      isRemoved = true
      // console.log('-->', x);
      // console.log(oldDocuments[x]._id);
      if (payload[x]._id.toString() === g._id.toString()) {
        isRemoved = false
        break
      }
      // console.log('isNew ', isNew);
    }
    return isRemoved
  })
  return removedDocuments
}

export function getUpdatedSubDocument (payload = [], oldDocuments = []) {
  const updatedDocuments = payload.filter((pDocument, index) => {
    let isUpdated = false
    // console.log('------------->', index);
    // console.log(pDocument._id);

    for (let x = 0; x < oldDocuments.length; x++) {
      isUpdated = false
      const oldDocument = oldDocuments[x]
      const oldDocumentString = JSON.stringify(
        JSON.parse(JSON.stringify(oldDocument))
      )
      const originalDocumentKeys = Object.keys(oldDocument.toObject()).sort(
        (a, b) => {
          if (a > b) {
            return 1
          }
          if (a < b) {
            return -1
          }
          // a must be equal to b
          return 0
        }
      )
      if (pDocument._id.toString() === oldDocument._id.toString()) {
        const newDocumentString = JSON.stringify(
          JSON.parse(JSON.stringify(pDocument))
        )
        const payloadDocumentKeys = Object.keys(pDocument.toObject()).sort(
          (a, b) => {
            if (a > b) {
              return 1
            }
            if (a < b) {
              return -1
            }
            // a must be equal to b
            return 0
          }
        )

        if (oldDocumentString.length !== newDocumentString.length) {
          isUpdated = true
          break
        }
        if (payloadDocumentKeys.length !== originalDocumentKeys.length) {
          isUpdated = true
          break
        }
        if (
          payloadDocumentKeys.toString() !== originalDocumentKeys.toString()
        ) {
          isUpdated = true
          break
        }
        for (let y = 0; y < payloadDocumentKeys.length; y++) {
          isUpdated = false
          const key = payloadDocumentKeys[y]
          if (pDocument[key]) {
            // console.log('pDocument[key].toString()', pDocument[key].toString());
            // console.log('oldDocument[key].toString()', oldDocument[key].toString());
            if (pDocument[key].toString() !== oldDocument[key].toString()) {
              isUpdated = true
              break
            }
          }
        }
        if (isUpdated) {
          break
        }
      }
    }
    return isUpdated
  })
  return updatedDocuments
}

export async function addRelationShipsToEntity (
  sourceModifiedDocument,
  targetEntity,
  targetEntityFieldName,
  targetEntitySubFieldName,
  sourceEntityPrimaryKeyValue,
  sourceEntityFieldName,
  sourceEntitySubFieldName,
  newRelationships = []
) {
  // console.log('START addRelationShipsToEntity')
  for (let x = 0; x < newRelationships.length; x++) {
    const newRelationship = newRelationships[x]
    try {
      // console.log(targetEntity)
      // console.log('newRelationship', newRelationship)
      // console.log('sourceEntityFieldName',sourceEntityFieldName)
      // console.log('sourceEntitySubFieldName',sourceEntitySubFieldName)

      // console.log('newRelationship[sourceEntitySubFieldName]', newRelationship[sourceEntitySubFieldName])
      const targetEntityDocument = await targetEntity.findById(
        newRelationship[sourceEntitySubFieldName]
      )
      // console.log('targetEntityDocument', targetEntityDocument);
      let relationshipFound = false
      if (targetEntityDocument) {
        if (targetEntityDocument[targetEntityFieldName]) {
          targetEntityDocument[targetEntityFieldName].forEach(
            (targetEntitySubDocument) => {
              if (
                targetEntitySubDocument[targetEntitySubFieldName] ===
                sourceEntityPrimaryKeyValue
              ) {
                // console.log('found relationship', targetEntitySubDocument)
                relationshipFound = targetEntitySubDocument
              }
            }
          )

          if (!relationshipFound) {
            // console.log('newRelationship', newRelationship)
            const newDocumentObject = JSON.parse(JSON.stringify(newRelationship))
            delete newDocumentObject[sourceEntitySubFieldName]
            newDocumentObject[
              targetEntityFieldName
            ] = sourceEntityPrimaryKeyValue
            // console.log('newRelationship', newDocumentObject)
            if (!Array.isArray(targetEntityDocument[targetEntityFieldName])) {
              targetEntityDocument[targetEntityFieldName] = []
            }
            const query = {
              _id: newRelationship[sourceEntitySubFieldName]
            }
            const originalDocuments = JSON.parse(
              JSON.stringify(targetEntityDocument[targetEntityFieldName])
            )
            originalDocuments.push(newDocumentObject)
            const documentsPayload = {}
            documentsPayload[targetEntityFieldName] = originalDocuments
            documentsPayload.updatedAt = new Date(Date.now()).toString()
            documentsPayload.updatedBy = sourceModifiedDocument.updatedBy
            const responseUpdate = await targetEntity.updateOne(
              query,
              { $set: documentsPayload },
              { runValidators: true }
            )
            console.log(responseUpdate)
          }
        }
      }
    } catch (err) {
      // console.log(err)
    }
  }
  // console.log('END addRelationShipsToEntity')
}

export async function removeRelationShipsFromEntity (
  sourceModifiedDocument,
  targetEntity,
  targetEntityFieldName,
  targetEntitySubFieldName,
  sourceEntityPrimaryKeyValue,
  sourceEntityFieldName,
  sourceEntitySubFieldName,
  removedRelationships = []
) {
  // console.log('START removeRelationShipsFromEntity')
  for (let x = 0; x < removedRelationships.length; x++) {
    const removedRelationship = removedRelationships[x]
    try {
      // console.log(targetEntity)
      // console.log('removedRelationship', removedRelationship)
      // console.log('sourceEntityFieldName',sourceEntityFieldName)
      // console.log('sourceEntitySubFieldName',sourceEntitySubFieldName)

      // console.log('removedRelationship[sourceEntitySubFieldName]', removedRelationship[sourceEntitySubFieldName])
      // get target entity document
      const targetEntityDocument = await targetEntity.findById(
        removedRelationship[sourceEntitySubFieldName]
      )
      // console.log(targetEntityDocument);
      let relationshipFound = false
      let relationshipIndexFound = -1
      // if target entity document exist
      if (targetEntityDocument) {
        // console.log('targetEntityDocument', JSON.parse(JSON.stringify(targetEntityDocument)))
        // console.log('targetEntityFieldName', targetEntityFieldName)
        // console.log('targetEntityDocument[targetEntityFieldName]', targetEntityDocument[targetEntityFieldName])
        // console.log(':::: sourceEntityPrimaryKeyValue', sourceEntityPrimaryKeyValue)
        // check if target entity document has the field which stores the relationship
        if (targetEntityDocument[targetEntityFieldName]) {
          // check if relationship exists in target Entity

          targetEntityDocument[targetEntityFieldName].forEach(
            (targetEntitySubDocument, index) => {
              // console.log(':: targetEntitySubDocument[targetEntitySubFieldName]', targetEntitySubDocument[targetEntitySubFieldName])
              // console.log(sourceEntityPrimaryKeyValue, targetEntitySubDocument[targetEntitySubFieldName])
              if (
                targetEntitySubDocument[targetEntitySubFieldName].toString() ===
                sourceEntityPrimaryKeyValue.toString()
              ) {
                // console.log('found relationship', targetEntitySubDocument)
                relationshipFound = targetEntitySubDocument
                relationshipIndexFound = index
              }
            }
          )

          if (relationshipFound) {
            // console.log('removedRelationship', removedRelationship)
            // console.log('relationshipFound ', relationshipFound)
            const originalDocuments = JSON.parse(
              JSON.stringify(targetEntityDocument[targetEntityFieldName])
            )
            originalDocuments.splice(relationshipIndexFound, 1)

            const documentsPayload = {}
            documentsPayload[targetEntityFieldName] = originalDocuments

            documentsPayload.updatedAt = new Date(Date.now()).toString()
            documentsPayload.updatedBy = sourceModifiedDocument.updatedBy
            const query = {
              _id: removedRelationship[sourceEntitySubFieldName]
            }
            const responseUpdate = await targetEntity.updateOne(
              query,
              { $set: documentsPayload },
              { runValidators: true }
            )
            console.log(responseUpdate)
          }
        }
      }
    } catch (err) {
      // console.log(err)
    }
  }
  // console.log('END removeRelationShipsFromEntity')
}

export async function updateRelationShipsOnEntity (
  sourceModifiedDocument,
  targetEntity,
  targetEntityFieldName,
  targetEntitySubFieldName,
  sourceEntityPrimaryKeyValue,
  sourceEntityFieldName,
  sourceEntitySubFieldName,
  updatedRelationships = []
) {
  // console.log('START updateRelationShipsOnEntity')
  for (let x = 0; x < updatedRelationships.length; x++) {
    const updatedRelationship = updatedRelationships[x]
    try {
      // console.log(targetEntity)
      // console.log('updatedRelationship', updatedRelationship)
      // console.log('sourceEntityFieldName',sourceEntityFieldName)
      // console.log('sourceEntitySubFieldName',sourceEntitySubFieldName)

      // console.log('updatedRelationship[sourceEntitySubFieldName]', updatedRelationship[sourceEntitySubFieldName])
      // get target entity document
      const targetEntityDocument = await targetEntity.findById(
        updatedRelationship[sourceEntitySubFieldName]
      )
      // console.log(targetEntityDocument);
      let relationshipFound = false
      let relationshipIndexFound = -1
      // if target entity document exist
      if (targetEntityDocument) {
        // console.log('targetEntityDocument', JSON.parse(JSON.stringify(targetEntityDocument)))
        // console.log('targetEntityFieldName', targetEntityFieldName)
        // console.log('targetEntityDocument[targetEntityFieldName]', targetEntityDocument[targetEntityFieldName])
        // console.log(':::: sourceEntityPrimaryKeyValue', sourceEntityPrimaryKeyValue)
        // check if target entity document has the field which stores the relationship
        if (targetEntityDocument[targetEntityFieldName]) {
          // check if relationship exists in target Entity

          targetEntityDocument[targetEntityFieldName].forEach(
            (targetEntitySubDocument, index) => {
              // console.log(':: targetEntitySubDocument[targetEntitySubFieldName]', targetEntitySubDocument[targetEntitySubFieldName])
              // console.log(sourceEntityPrimaryKeyValue, targetEntitySubDocument[targetEntitySubFieldName])
              if (
                targetEntitySubDocument[targetEntitySubFieldName].toString() ===
                sourceEntityPrimaryKeyValue.toString()
              ) {
                // console.log('found relationship', targetEntitySubDocument)
                relationshipFound = targetEntitySubDocument
                relationshipIndexFound = index
              }
            }
          )

          if (relationshipFound) {
            // console.log('updatedRelationship', updatedRelationship)
            // console.log('relationshipFound ', relationshipFound)

            const updatedDocumentObject = JSON.parse(
              JSON.stringify(updatedRelationship)
            )
            // remove field related to source entity
            delete updatedDocumentObject[sourceEntitySubFieldName]
            // add field related to target entity
            updatedDocumentObject[
              targetEntityFieldName
            ] = sourceEntityPrimaryKeyValue
            // console.log('updatedDocumentObject', updatedDocumentObject)

            const originalDocuments = JSON.parse(
              JSON.stringify(targetEntityDocument[targetEntityFieldName])
            )
            originalDocuments.splice(
              relationshipIndexFound,
              1,
              updatedDocumentObject
            )

            const documentsPayload = {}
            documentsPayload[targetEntityFieldName] = originalDocuments

            documentsPayload.updatedAt = new Date(Date.now()).toString()
            documentsPayload.updatedBy = sourceModifiedDocument.updatedBy
            const query = {
              _id: updatedRelationship[sourceEntitySubFieldName]
            }
            const responseUpdate = await targetEntity.updateOne(
              query,
              { $set: documentsPayload },
              { runValidators: true }
            )
            console.log(responseUpdate)
          }
        }
      }
    } catch (err) {
      // console.log(err)
    }
  }
  // console.log('END updateRelationShipsOnEntity')
}

export async function doOnPostHook (document, relations) {
  for (let x = 0; x < relations.length; x++) {
    const relObject = relations[x]
    const {
      // field name which stores the relationships objects on this document
      sourceEntityFieldName,
      // field name from source document used to search by ID on targetEntity ( newRelationship[sourceEntitySubFieldName] and removedRelationship[sourceEntitySubFieldName] )
      sourceEntitySubFieldName,
      // mongoose virtual field name which stores previous relationship array state
      previousVirtualName,
      // set the Entity model as target entity which we want to add/remove relationships based on newRelationships and removedRelationships
      targetEntity,
      // set targetEntity.targetEntityFieldName as the field which we want to add/remove relationships based on newRelationships and removedRelationships
      targetEntityFieldName,
      // set field name to be used as parameter when searching on targetEntity subdocument
      targetEntitySubFieldName
    } = relObject

    if (Array.isArray(document[sourceEntityFieldName])) {
      // set document._id as reference value to search on targetEntity[targetEntityFieldName]
      const sourceEntityPrimaryKeyValue = document._id
      // check what are the new relationships added to document[sourceEntityFieldName] on client side
      const newRelationships = getNewSubDocument(
        document[sourceEntityFieldName],
        document[previousVirtualName]
      )
      // check what are the removed relationships from document[sourceEntityFieldName] on client side
      const removedRelationships = getRemovedSubDocument(
        document[sourceEntityFieldName],
        document[previousVirtualName]
      )
      // check what are the updated relationships from document[sourceEntityFieldName] on client side
      const updatedRelationships = getUpdatedSubDocument(
        document[sourceEntityFieldName],
        document[previousVirtualName]
      )

      // add new relationships to target entity
      await addRelationShipsToEntity(
        document,
        targetEntity,
        targetEntityFieldName,
        targetEntitySubFieldName,
        sourceEntityPrimaryKeyValue,
        sourceEntityFieldName,
        sourceEntitySubFieldName,
        newRelationships
      )

      // remove relationships from target entity
      await removeRelationShipsFromEntity(
        document,
        targetEntity,
        targetEntityFieldName,
        targetEntitySubFieldName,
        sourceEntityPrimaryKeyValue,
        sourceEntityFieldName,
        sourceEntitySubFieldName,
        removedRelationships
      )

      // update relationships from target entity
      await updateRelationShipsOnEntity(
        document,
        targetEntity,
        targetEntityFieldName,
        targetEntitySubFieldName,
        sourceEntityPrimaryKeyValue,
        sourceEntityFieldName,
        sourceEntitySubFieldName,
        updatedRelationships
      )
    }
  }
}

export async function uploadBase64stringAsFile (
  fileString,
  job,
  entityDir,
  webPath
) {
  const fArray = fileString.split('base64,')
  const typeString = fArray[0].replace(/data\:/, '').replace(/;/, '')
  const typeStringArray = typeString.split('/')
  const typeOfFile = typeStringArray[0]
  const fileExtension = typeStringArray[1]
  const base64File = fArray[1]
  const finalFileName = `${typeOfFile}_${
      job.from.userId || uuid()
    }_${uuid()}.${fileExtension}`
  const ioResult = await writeFileAsync(
      `${entityDir}${finalFileName}`,
      base64File,
      'base64'
  )
  return {
    error: ioResult,
    file: `${webPath}${finalFileName}`
  }
}
export function composeMessageAlert (message, os) {
  message = message || ''
  message += ' - Hostname: ' + os.hostname() + '<br>'
  message += ' - Platform: ' + os.platform() + '<br>'
  message += ' - Arch: ' + os.arch() + '<br>'
  message += ' - Type: ' + os.type() + '<br>'
  message += ' - OS Release: ' + os.release() + '<br>'
  message += ' - Uptime: ' + os.uptime() / 60 / 60 + ' hours<br>'
  message += ' - # of CPUS: ' + os.cpus().length + '<br>'
  message +=
    ' - Free Memory: ' + (os.freemem() / 1024 / 1024).toFixed(2) + ' mb<br>'
  message +=
    ' - Total Memory: ' +
    (os.totalmem() / 1024 / 1024).toFixed(2) +
    ' mb<br><br><br>'
  // message += " - Redis connection status: " + ( redis.connected ? "connected" : "not connected" ) + " <br><br>";
  // message += " - RabbitMQ connection status: " + ( redis.connected ? "connected" : "not connected" ) + " <br><br>";
  message +=
    'Please make sure that is everything ok with ' +
    config[env].name +
    '.<br><br>'
  message += 'Best Regards.<br><br>'
  message += 'Distributed Computing Team.'
  return message
}

export function getStatsAsobject (os) {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch(),
    type: os.type(),
    release: os.release(),
    uptime: os.uptime() / 60 / 60,
    cpus: os.cpus().length,
    cpus_info: os.cpus(),
    freeram: (os.freemem() / 1024 / 1024).toFixed(2),
    totalram: (os.totalmem() / 1024 / 1024).toFixed(2)
  }
}
