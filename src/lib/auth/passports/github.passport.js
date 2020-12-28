import passport from 'passport'
import { Strategy as GitHubStrategy } from 'passport-github'
import { User } from '../../models/mongoose/User'
import config from '../../../config'

const env = process.env.NODE_ENV || 'development'
const conf = config[env]

passport.use(
  new GitHubStrategy(
    {
      clientID: conf.oAuth.github.clientID,
      clientSecret: conf.oAuth.github.clientSecret,
      callbackURL: conf.oAuth.github.callbackURL
    },
    (accessToken, refreshToken, profile, done) => {
      let social = profile
      social.email = profile._json.email
      social.photo = profile._json.avatar_url

      User.loginBySocial('github', social)
        .then((user) => done(null, user))
        .catch((err) => done(err))
    }
  )
)
