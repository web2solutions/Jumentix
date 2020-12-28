// import bcrypt from 'bcrypt';
import { sha512 } from 'js-sha512'
import { calcUsername } from '../../../util'

export default (User) => {
  // Trigger method's before save
  User.pre('save', async function (next) {
    let self = this

    next()
  })

  User.pre('findOneAndUpdate', function (next, a) {
    // console.log(' PRE ------------->>>>>> findOneAndUpdate: ', this);
    /* console.log('xxxxxxxxxxxxxxxxxx')
      console.log(this.getQuery());
      console.log(this.getFilter());
      console.log(a);
      */
    next()
  })

  User.post('findOneAndUpdate', async function (document) {
    // console.log(' POST ------------->>>>>> findOneAndUpdate: ', document.portal_access);
    // console.log(' POST ------------->>>>>> findOneAndUpdate: ', document.portal_access);
    // console.log(' POST ------------->>>>>> findOneAndUpdate: ', document._previousPassword);
    // console.log(' POST ------------->>>>>> findOneAndUpdate: ', document.password);
    // console.log(user.isModified('password'));
    // this._update.$set.objects = [];
    // this._update.$set.people = [];
    // this._update.$set.events =  [];
    // next();
  })

  // Trigger method's after save
  User.post('save', function (err, doc, next) {
    if (err.name === 'MongoError' && err.code === 11000) {
      return next(err.message || err) // "${doc.username}"
    } else {
      return next(err)
    }
  })
}
