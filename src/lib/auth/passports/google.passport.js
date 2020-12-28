import passport from 'passport'
import { OAuth2Strategy as GoogleStrategy } from 'passport-google-oauth'
import { User } from '../../models/mongoose/User'
import config from '../../../config'

const env = process.env.NODE_ENV || 'development'
const conf = config[env]

passport.use(
  new GoogleStrategy(
    {
      clientID: conf.oAuth.google.clientID,
      clientSecret: conf.oAuth.google.clientSecret,
      callbackURL: conf.oAuth.google.callbackURL
    },
    (accessToken, refreshToken, profile, done) => {
      let social = profile
      social.photo = profile._json.image.url

      User.loginBySocial('google', social)
        .then((user) => done(null, user))
        .catch((err) => done(err))
    }
  )
)
