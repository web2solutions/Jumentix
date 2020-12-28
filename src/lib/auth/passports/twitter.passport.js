import passport from 'passport'
import { Strategy as TwitterStrategy } from 'passport-twitter'
import { User } from '../../models/mongoose/User'
import config from '../../../config'

const env = process.env.NODE_ENV || 'development'
const conf = config[env]

passport.use(
  new TwitterStrategy(
    {
      consumerKey: conf.oAuth.twitter.clientID,
      consumerSecret: conf.oAuth.twitter.clientSecret,
      callbackURL: conf.oAuth.twitter.callbackURL
    },
    (token, tokenSecret, profile, done) => {
      let social = profile
      social.email = profile.emails[0].value
      social.photo = profile._json.profile_image_url

      User.loginBySocial('twitter', social)
        .then((user) => done(null, user))
        .catch((err) => done(err))
    }
  )
)
