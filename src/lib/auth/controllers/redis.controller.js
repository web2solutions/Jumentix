import { result, error } from '../../response'
import { call } from '../../redis-jwt'

/* Administrator */

// Get section
export function section(req, res) {
  console.log('----> redis.controller', req.swagger.params.section.value)
  return call
    .getInfo(req.swagger.params.section.value)
    .then((info) => {
      // console.log('call.getInfo')
      // console.log('info')
      // console.log(info)
      res.send(info.toString())
    })
    .catch((err) => {
      console.log(err)
      console.log(err)
      error(res)
    })
}
