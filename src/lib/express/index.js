import helmet from 'helmet'
import bodyParser from 'body-parser'
import compression from 'compression'
import methodOverride from 'method-override'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import session from 'express-session'
import cors from 'cors'
import busboyBodyParser from 'busboy-body-parser'
// import morgan from 'morgan';
import config from '../../config'
const env = process.env.NODE_ENV || 'development'

export async function start(webapp, application) {
  let error = false
  try {
    webapp.use(
      bodyParser.json({
        limit: config[env].http_body_size // '50mb'
      })
    )
    webapp.use(
      bodyParser.urlencoded({
        extended: false
      })
    )

    webapp.use(busboyBodyParser())
    // busboyBodyParser
    webapp.use(cookieParser())
    webapp.use(methodOverride())
    webapp.use(compression())
    webapp.use(helmet())
    webapp.use(
      cors({
        origin: true,
        credentials: true
      })
    )

    /* if ("twitter" in config.oAuth && config.oAuth.twitter.enabled)
            webapp.use(session({
                secret: config.secret,
                resave: false,
                saveUninitialized: false
            }));
        */
    webapp.use(passport.initialize())
    webapp.use(passport.session())
    // Morgan
    // if (config.log)
    //    webapp.use(morgan('dev'));
    return { error }
  } catch (e) {
    console.log(e)
    return { error: e }
  }
}
