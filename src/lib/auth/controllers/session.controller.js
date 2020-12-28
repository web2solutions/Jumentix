import { result, notFound, error } from '../../response'
import { call } from '../../redis-jwt'

// List of sessions by user
export function list(req, res) {
  // console.log('XVXVXVXVXVXVXVXVXXVXVVXVXVXVXVXVVXVXVXVXVVX', req.user._id)
  /* return call
    .getValuesByPattern(req.user._id)
    .then(notFound(res))
    .then((all) => {
      for (let prop in all) {
        all[prop] = JSON.parse(all[prop])
      }
      return result(res, all)
    })
    .catch(error(res))
  */
  return (async () => {
    const a = await call.getValuesByPattern(req.user._id)
    if (a.length < 1) {
      return notFound(res)
    }
    for (const prop in a) {
      a[prop] = JSON.parse(a[prop])
    }
    return result(res, a)
  })()
}

// Destroy a session
export function destroy(req, res) {
  return call
    .destroy(`${req.user._id}:${req.swagger.params.id.value.split(':')[1]}`)
    .then(notFound(res))
    .then(result(res))
    .catch(error(res))
}

// Destroy a current session
export async function logout(req, res) {
  // console.log('----> logout')
  try {
    let ok = await call.destroy(req.user.session.rjwt)
    if (ok) {
      return result(res, { message: 'User is logout' })
    } else {
      return error(res, { message: 'Could not logout', error: {} })
    }
  } catch (error) {
    console.log('----> logout err:', error)
    return error(res, { message: 'Could not logout', error })
  }
}

/* Administrator */

// List of sessions by id
export function listAdmin(req, res) {
  return call
    .getValuesByPattern(req.swagger.params.id.value)
    .then(notFound(res))
    .then((all) => {
      for (let prop in all) {
        all[prop] = JSON.parse(all[prop])
      }
      return result(res, all)
    })
    .catch(error(res))
}

// Destroy a session by rjwt
export function destroyAdmin(req, res) {
  return call
    .destroy(`${req.swagger.params.id.value}`)
    .then(notFound(res))
    .then(result(res))
    .catch(error(res))
}

// Logout a user by id
export function logoutAdmin(req, res) {
  return call
    .destroyMultiple(req.swagger.params.id.value)
    .then(notFound(res))
    .then(result(res))
    .catch(error(res))
}
