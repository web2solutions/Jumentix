import { calc, time } from 'role-calc'
import { UserAccess } from '../../models/mongoose/UserAccess'
import { r } from '../../redis-jwt'
import app from '../../../app'
import config from '../../../config'
import { error, result, invalid, unauthorized } from '../../response'
// import { copy } from '../../util'

const env = process.env.NODE_ENV || 'development'
const conf = config[env]

// Initialize after login success
export async function initialize (err, user, res, req) {
  // console.log('----> session.service initialize', info)
  let ttl = null
  let nowInMs = 0
  let _expiresInMs = 0
  let expires = new Date()
  let info = {
    session_id: '0'
  }
  let tokenKey = ''
  let userObject = {}

  if (typeof req.body.info !== 'undefined') {
    info = req.body.info
  }

  try {
    // Errors
    if (err) {
      console.error(' err err err err', err)
      return invalid(res, {
        message: err.message || err,
        error: err.stack || err.message || err || {}
      })
    }

    if (!user) {
      console.error(' NOT USER >>>>>>>> ', user)
      return unauthorized(res, {
        message: 'Something went wrong with "user", please try again.'
      })
    }

    if (!user.human) {
      console.error(' NOT USER >>>>>>>> ', user)
      return unauthorized(res, {
        message: 'Something went wrong "user.human", please try again.'
      })
    }

    nowInMs = new Date().getTime()

    // Calculate ttl by user roles, by default takes the role with the longest 'max'
    ttl = calc(time(conf.roles, user.roles), 'max')

    tokenKey = user._id.toString()// + '_' + info.session_id
    // console.log('DFDFDFDFDFDFDFFD', tokenKey)

    userObject = JSON.parse(JSON.stringify(user))
    userObject.name = user.human.first_name + ' ' + user.human.last_name
    userObject.role = userObject.roles[0]
    delete userObject.password

    const token = await r.sign(tokenKey, {
      ttl,
      dataSession: {
        // save data in REDIS (Private)
        // ip : res.req.headers['x-forwarded-for'] || res.req.connection.remoteAddress,
        // agent : res.req.headers['user-agent']
      },
      dataToken: {
        // save data in Token (Public)
        // example : 'I travel with the token!'
        user: userObject
      }
    })

    if (typeof ttl === 'string') {
      _expiresInMs = parseInt(ttl.split(' ')[0]) * 60 * 1000
      expires = new Date(_expiresInMs + nowInMs)
    }

    // Save token in cookies
    /* res.cookie('token', JSON.stringify(token), {
      maxAge: _expiresInMs + nowInMs,
      httpOnly: true
    }) */

    // // console.log(access)
    // userObject must have access
    // const access = new app.$cassandra.instance.UserAccess(accessDocumentPayload)
    // const r = await access.saveAsync()
    // console.error(r)
    // console.error('======>>>>>>>>', { user: '' + user._id })
    const response = await app.$cassandra.instance.UserAccess.findAsync({
      user: '' + user._id,
      // $orderby: { $desc: 'date' },
      // group results by a certain field or list of fields
      // $groupby: [ 'age' ],
      // limit the result set to 10 rows
      $limit: 50
    }, { raw: true })

    userObject.access = response
    // console.error('======>>>>>>>>', userObject.access)
    // userObject.access = await UserAccess.find({ user: user._id })
    //  .sort({ date: -1 })
    //  .limit(50)

    // if local return token
    if (user.provider === 'local') {
      return result(res, {
        token,
        user: userObject,
        expires,
        api: 'http://' + conf.server.ip + ':' + conf.server.port + '/'
      })
    }

    // if Social redirect to..
    res.redirect(`/?token=${token}`)
  } catch (err) {
    console.error('XX>>>>>> ', err)
    return error(res, {
      message: err
    })
  }
}
