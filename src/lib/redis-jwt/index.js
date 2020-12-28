import RedisJWT from 'redis-jwt'
import chalk from 'chalk'
import conf from '../../config/redis'
const env = process.env.NODE_ENV || 'development'
const config = conf[env]

export const r = new RedisJWT(config)

export const exec = r.exec()

export const call = r.call()

export function connect() {
  return new Promise((resolve, reject) => {
    r.on('ready', () => {
      console.info(
        chalk.greenBright(
          `-------\nRedis-jwt-> connected on ${config.host}:${config.port}/${config.db}\n-------`
        )
      )
      resolve()
    })

    r.on('error', (err) => {
      console.error(chalk.redBright(err))
    })
  })
}
