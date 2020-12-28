import passport from 'passport'
import { initialize } from '../services/session.service'

// import app from '../../../app'

// Callback passport
export function callback(req, res, next) {
  // console.log('------------> local.controller')
  try {
    passport.authenticate('local', (err, user) => {
      if (!!err) {
        console.log('PASSPORT err', err)
      }
      // console.log('user', user)
      initialize(err, user, res, req)
    })(req, res, next)
  } catch (e) {
    console.error(e)
  }
}
