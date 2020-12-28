// import bcrypt from 'bcrypt';
import { sha512 } from 'js-sha512'
export default (User) => {
  // Methods
  User.methods = {
    // Compare password
    authenticate(candidatePassword) {
      // console.log( candidatePassword,  this.password)
      // return bcrypt.compare(candidatePassword, this.password);
      // return sha512( candidatePassword ) === this.password
      return candidatePassword === this.password
    }
  }
}
