import { unauthorized, forbidden, error } from '../../response'
import { has } from 'role-calc'
import { r } from '../../redis-jwt'

import { User } from '../../models/mongoose/User'

// VerifyToken
export async function mw (req, authOrSecDef, token, cb) {
  try {
    const requiredRoles = req.swagger.operation['x-security-scopes']
    let session = null
    let userId = null
    let _user = null
    if (token) {
      token = token.split(' ')[1]

      if (!token) {
        return cb(
          unauthorized(req.res, {
            message: `invalid token ${token}`,
            error: `invalid token ${token}`
          })
        )
      }
      if (typeof token === 'undefined') {
        return cb(
          unauthorized(req.res, {
            message: `invalid token ${token}`,
            error: `invalid token ${token}`
          })
        )
      }
      if (token === 'undefined') {
        return cb(
          unauthorized(req.res, {
            message: `invalid token ${token}`,
            error: `invalid token ${token}`
          })
        )
      }

      // Verify Token with redis-jwt -> if you want to extract the data you should add true: r.verify(token, true)
      try {
        session = await r.verify(token, true)
        if (!session) {
          return cb(unauthorized(req.res))
        }
      } catch (e) {
        // console.log(typeof token, token)
        // console.log('------->>>X', e)
        return cb(error(req.res, e))
      }

      userId = session.dataToken.user._id

      // Extract info user from MongoDB
      _user = false

      try {
        _user = await User.findById(userId).populate('human').select('-social')
      } catch (e) {
        // console.log(e)
        return cb(
          error(req.res, {
            message: `Error looking for user ${userId}`,
            error: e
          })
        )
      }

      if (!_user) {
        return cb(
          unauthorized(req.res, {
            message: 'there is no user associated to this token'
          })
        )
      }

      _user = JSON.parse(JSON.stringify(_user))

      // User is enabled?
      if (!_user.active) {
        return cb(unauthorized(req.res, { message: 'User is not active' }))
      }

      // console.info('user is active <-------')

      if (!_user.human) {
        return cb(unauthorized(req.res, { message: 'user.human is not valid' }))
      }

      if (_user.human === null) {
        return cb(unauthorized(req.res, { message: 'user.human is not valid' }))
      }

      if (typeof _user.human === 'undefined') {
        return cb(unauthorized(req.res, { message: 'user.human is not valid' }))
      }

      if (!_user.portal_access) {
        return cb(
          unauthorized(req.res, { message: 'User has no portal access' })
        )
      }

      // Verify Roles
      if (requiredRoles) {
        if (!has(requiredRoles, _user.roles)) {
          return cb(forbidden(req.res, { message: 'Role not authorized' }))
        }
      }

      _user.id = _user._id
      _user.name = _user.human.first_name + ' ' + _user.human.last_name
      _user.user_email = _user.username
      _user.photo = _user.avatar
      _user.userId = _user._id
      _user.role = _user.roles[0]
      _user.user_type = _user.roles[0]

      // Success
      req.user = Object.assign({ session }, _user)

      return cb(null)
    } else {
      // console.info('mw.service token does not exist')
      // console.info('--------------> mw.service', token)
      return cb(unauthorized(req.res, { message: 'Invalid Token' }))
    }
  } catch (e) {
    // console.error('catch error', e)
    return cb(error(req.res, e))
  }
}
