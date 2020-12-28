import app from '../../../app'
import RabbitEnvelop from '../../RabbitEnvelop'
import { errorResponse, notFound, result } from '../../response'
import { copy, isDate, isObject } from '../../util'

/**
    Create an entity by sending a message to it queue.
*/
export async function bulkListAllCollections(req, res) {
  // console.log('INSIDE BULK >>>>>>>>>>>>>>>>>>>>>>>>>')
  let _errors = []
  let _data = []
  let collections = req.swagger.params.collections.value || '{}'
  let lastSyncDate = req.swagger.params.lastSyncDate.value || false
  // let collections = '{ "Human": "Human" }'
  let allData = {}

  collections = JSON.parse(collections)

  if (!isObject(collections)) {
    _errors.push('Colections must be a valid JSON')
  }

  if (req.user) {
    for (let key in collections) {
      let envelop = new RabbitEnvelop({
        from: req.user,

        entity: key,
        action: 'getAll',
        payload: {
          returnAll: true
          // where: {
          //    updatedAt: {"$gte": new Date(2012, 7, 14), "$lt": new Date(2012, 7, 15)}
          // }
        }
      })
      if (lastSyncDate) {
        // console.log('lastSyncDate', lastSyncDate)
        // console.log('isDate', isDate(new Date(lastSyncDate)))
        // emulate swagger payload
        let where = {
          schema: true,
          value: JSON.stringify({
            updatedAt: {
              $gte: new Date(lastSyncDate)
            }
          })
        }
        envelop.payload.where = where
      }
      // console.log(key)
      if (app.mapperRPC) {
        if (
          app.mapperRPC.services[key] &&
          app.mapperRPC.services[key] !== null
        ) {
          try {
            let {
              error,
              data,
              status,
              count,
              pages,
              limit,
              page
            } = await app.mapperRPC.services[key].getAll(envelop)
            if (error) {
              _errors.push(error)
            } else {
              if (data) {
                allData[key] = data
              }
            }
          } catch (e) {
            // console.log(key)
            _errors.push({
              error: e
            })
            _errors.push({
              error: key + ' does not exist'
            })
          }
        } else {
          _errors.push({
            error: key + ' does not exist'
          })
        }
      } else {
        _errors.push({
          error: 'RPC mapper is null'
        })
      }
    }
  } else {
    _errors.push('There is no user set for this request')
  }

  if (_errors.length > 0) {
    // app.console.warn( _errors )
    return result(res, {
      message: 'Could not Bulk list the collections',
      error: _errors
    })
  }

  return result(res, {
    message: 'Bulk list all collections is done',
    data: allData
  })
}
