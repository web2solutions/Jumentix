export function genericErrorHandler (err, req, res, next) {
  // console.log('genericErrorHandler')
  if (typeof err !== 'object') {
    // If the object is not an Error, create a representation that appears to be
    err = {
      message: String(err) // Coerce to string
    }
  } else {
    // Ensure that err.message is enumerable (It is not by default)
    Object.defineProperty(err, 'message', {
      enumerable: true
    })
  }
  try {
    return res.status(res.statusCode).json({ message: err.message, error: err })
  } catch (e) {
  } finally {
    // next();
  }
}

export function generic404 (req, res) {
  return res.status(404).json({ message: 'Not Found' })
}

export function result (
  res,
  data = { message: 'Ok', data: {} },
  statusCode = 200
) {
  return res.status(statusCode).json(data)
}

export function accepted (res, data = { message: 'Accepted', data: {} }) {
  data.message = 'Accepted'
  return res.status(202).json(data)
}

export function created (res, data = { message: 'Accepted', data: {} }) {
  return res.status(201).json(data)
}

export function error (
  res,
  data = { message: 'Server Error', error: {} },
  statusCode = 500
) {
  return res.status(statusCode).json(data)
}

export function errorResponse (
  res,
  data = { message: 'Server Error', error: {} },
  statusCode = 500
) {
  return res.status(statusCode).json(data)
}

export function notFound (
  res,
  data = { message: 'Not Found', error: {} },
  statusCode = 404
) {
  return res.status(statusCode).json(data).end()
}

export function unauthorized (
  res,
  data = { message: 'Unauthorized', error: {} },
  statusCode = 401
) {
  return res.status(statusCode).json(data)
}

export function forbidden (
  res,
  data = { message: 'Forbidden', error: {} },
  statusCode = 403
) {
  return res.status(statusCode).json(data)
}

export function badRequest (
  res,
  data = { message: 'Bad Request', error: {} },
  statusCode = 400
) {
  return res.status(statusCode).json(data)
}

export function unsupportedAction (
  res,
  data = { message: 'Unsupported Action', error: {} },
  statusCode = 405
) {
  return res.status(statusCode).json(data)
}

export function invalid (
  res,
  data = { message: 'Unprocessable Entity', error: {} },
  statusCode = 422
) {
  return res.status(statusCode).json(data)
}
