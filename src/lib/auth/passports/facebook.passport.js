import passport from 'passport'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import { User } from '../../models/mongoose/User'
import config from '../../../config'

const env = process.env.NODE_ENV || 'development'
const conf = config[env]

passport.use(
  new FacebookStrategy(
    {
      clientID: conf.oAuth.facebook.clientID,
      clientSecret: conf.oAuth.facebook.clientSecret,
      callbackURL: conf.oAuth.facebook.callbackURL
    },
    (accessToken, refreshToken, profile, done) => {
      let social = profile
      social.email = profile.emails[0].value
      social.photo = `http://graph.facebook.com/${profile.id}/picture?type=square`

      User.loginBySocial('facebook', social)
        .then((user) => done(null, user))
        .catch((err) => done(err))
    }
  )
)
