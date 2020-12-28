import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { User } from '../../models/mongoose/User'

passport.use(
  'local',
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true
    },
    function (req, username, password, done) {
      ;(async function () {
        let info = {
          session_id: '0'
        }

        if (typeof req.body.info !== 'undefined') {
          info = req.body.info
        }

        try {
          let { error, user } = await User.loginByLocal(
            username,
            password,
            info
          )
          if (error) {
            console.log('Passport callback', error)
          }
          if (error) {
            throw error
          }
          done(error, user)
        } catch (e) {
          console.log('error calling User.loginByLocal')
          console.log(e.message)
          done(e)
        }
      })()
    }
  )
)
