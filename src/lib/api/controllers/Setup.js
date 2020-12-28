import { result } from '../../response'
import RabbitEnvelop from '../../RabbitEnvelop'
import app from '../../../app'

import RoleSeed from '../../models/mongoose/seeds/Role'

// console.log(RoleSeed)

let __CAIRS_USER__ = {
    userId: '0',
    companyId: 0,
    user_email: 'eduardo.almeida@cairsolutions.com',
    name: 'Jose Eduardo',
    deleted: false,
    active: true,
    human: {
      _id: '0'
    },
    id: new Date().getTime()
  },
  admin_user = {
    username: 'admin@admin.com',
    password: '123', // 123
    roles: ['admin'],
    provider: 'local',
    portal_access: true,
    changePasswordNextLogin: true
  },
  admin_human = {
    email: [{ type: 'Work', email: 'admin@admin.com' }],
    first_name: 'Admin',
    last_name: 'Last Name',
    nationality: 'American',
    gender: 'Male',
    sexual_orientation: 'Heterosexual/Straight',
    ssn: '017-90-7890'
  },
  _errors = [],
  _data = [],
  nuser = null,
  nhuman = null

async function addHumanAndUser(human, user) {
  let newUser = null
  // create user
  let { error, data } = await app.mapperRPC.services.User.create(
    new RabbitEnvelop({
      from: __CAIRS_USER__,
      entity: 'User',
      action: 'create',
      payload: user
    })
  )
  // check if is there a error executing the job
  if (error) {
    _errors.push(error)
  } else {
    nuser = data
    newUser = data
    _data.push(data)
    await addHuman(human, newUser)
  }
}

async function addHuman(human, newUser) {
  human.user = newUser._id
  // create human
  let { error, data } = await app.mapperRPC.services.Human.create(
    new RabbitEnvelop({
      from: __CAIRS_USER__,
      entity: 'Human',
      action: 'create',
      payload: human
    })
  )
  if (error) {
    _errors.push(error)
    return
  }
  nhuman = data
  _data.push(data)
  await alterNewUser(newUser, data)
}

async function alterNewUser(newUser, newHuman) {
  try {
    newUser.human = newHuman._id
    await newUser.save()

    let nuser = { ...newUser }
    nuser.human = newHuman

    await createRoles(nuser)
  } catch (e) {
    console.log(e)
    _errors.push(e)
  }
}

async function createRoles(nuser) {
  nuser.companyId = 0
  nuser.user_email = admin_user.username
  nuser.name = admin_human.first_name + ' ' + admin_human.last_name
  nuser.active = 1
  try {
    for (let x = 0; x < RoleSeed.data.length; x++) {
      let record = RoleSeed.data[x]
      let { error, data } = await app.mapperRPC.services.Role.create(
        new RabbitEnvelop({
          from: nuser,
          entity: 'Role',
          action: 'create',
          payload: record
        })
      )
      if (error) {
        _errors.push(error)
      }
      if (data) {
        _data.push(data)
      }
    }
  } catch (e) {
    _errors.push(e)
  }
}

export async function Setup(req, res) {
  _errors = []
  _data = []
  await addHumanAndUser(admin_human, admin_user)

  if (_errors.length > 0) {
    // app.console.warn( _errors )
    return result(res, {
      message: 'Could not setup admin user',
      error: _errors
    })
  }

  return result(res, { message: 'Setup is done', data: _data })
}
