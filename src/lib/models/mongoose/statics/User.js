import { UserAccess } from '../UserAccess'

// console.log('xxxxxxx')
// console.log(UserAccess)
import app from '../../../../app'
export default (User) => {
  // Statics
  User.statics = {
    async loginByLocal (username = false, password = false, info = {}) {
      const User = this
      // const session = false
      let user = false

      if (!username) {
        return { error: 'Please provide an username.', user }
      }
      if (!password) {
        return { error: 'Please provide a password.', user }
      }
      if (typeof username !== 'string') {
        return { error: 'Please provide an username.', user }
      }
      if (typeof password !== 'string') {
        return { error: 'Please provide a password.', user }
      }

      // const _user = false
      let xuser = false
      const dt = Date.now()
      // let accessDocument = null
      const accessDocumentPayload = {
        date: dt,
        ...info
      }
      const query = { username, password, provider: 'local' }
      const document = {
        $set: { last_login: dt }
        // $push: { access: nac }
      }
      const options = {
        new: true
      }

      try {
        // session = await User.startSession()
        // session.startTransaction( { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } })

        user = await User.findOneAndUpdate(query, document, options)
          .populate('human')
          .select('+password')
        // user = await User.findOne( query ).populate('human').select("+password")

        if (!user) {
          // await session.abortTransaction()
          // session.endSession()
          return { error: 'Wrong username or password.', user: false }
        }

        accessDocumentPayload.user = '' + user._id
        // console.log(accessDocumentPayload)
        // accessDocument = await UserAccess.create(accessDocumentPayload)

        // await UserAccess.create(accessDocumentPayload)
        const access = new app.$cassandra.instance.UserAccess(accessDocumentPayload)
        await access.saveAsync()
        // console.error(r)
        // await session.commitTransaction()
        // session.endSession()

        xuser = JSON.parse(JSON.stringify(user))

        return {
          error: null,
          user: xuser
        }
      } catch (error) {
        // statements
        // await session.abortTransaction()
        // session.endSession()
        console.log('inside User.loginByLocal()')
        console.log(error.message)
        return { error, user }
      }
    },

    loginBySocial (provider, profile) {
      return new Promise((resolve, reject) => {
        const User = this

        User.findOne({
          provider,
          'social.id': profile.id
        })
          .exec()
          .then((user) => {
            if (!user) {
              user = new User({
                provider: provider,
                name: profile.displayName,
                username: profile.username,
                email: profile.email || '',
                photo: profile.photo || '',
                'social.id': profile.id,
                'social.info': profile._json
              })
            } else {
              user.social.info = profile._json
              user.photo = profile.photo || ''
            }

            user.last_login = Date.now()

            user
              .save()
              .then((_user) => resolve(_user))
              .catch((err) => reject(err))
          })
          .catch((err) => reject(err))
      })
    },

    async findOneByUsername (username) {
      let error = null
      let user = null
      try {
        // statements
        user = await this.findOne({ username }).countDocuments()
        if (!user) {
          error = 'User not found'
        }
        return { error, user }
      } catch (e) {
        // statements
        return { error: e, user }
      }
    } /* ,
    async register (payload) {
      let error = null
      let user = null
      try {
        // statements
        user = await this.create(payload)
        // console.log('_createMongo record', record)
        // data = await record.save()

        this.application.clearKey(this.entity)
        if (!user) {
          error = 'User not found'
        }
        return { error, user }
      } catch (e) {
        // statements
        return { error: e, user }
      }
    } */
  }
}
