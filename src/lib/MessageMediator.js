'use strict'

import SocketIO from 'socket.io'
import redisAdapter from 'socket.io-redis'
import chalk from 'chalk'
import {
  validName,
  findIndex,
  sanitizeString,
  uuid,
  getPersonalRoomName,
  isArray,
  copy
} from './util'
import $channel from './mediator/channel'

// mixin
const MessageMediator = (MessageMediator) =>
  class extends MessageMediator {
    async startMediator () {
      const response = { error: null, started: false }
      try {
        this.createSockerServer()
        this.setRedisAdapter()
        const socketStarted = await this.setSocketLayer()
        if (socketStarted) {
          response.started = true
        }
      } catch (e) {
        // statements
        // console.log(e);
        response.error = e
        response.started = false
      }
      return response
    }

    createSockerServer () {
      this.io = new SocketIO(this.server, {
        transports: ['websocket', 'polling']
      })
      this.console.info(' socket io is ready: ')
    }

    setRedisAdapter () {
      const self = this

      this.io.adapter(
        redisAdapter({
          pubClient: self.redis.pub,
          subClient: self.redis.sub
        })
      )

      // handling Redis adpater errors
      // self.io.adapter.pubClient.on('error', function(){
      //    self.serviceStop()
      // })
      // self.io.adapter.subClient.on('error', function(){
      //    self.serviceStop()
      // })
    }

    disconnectAllClients () {
      for (const id in this.sockets) {
        if (this.sockets.hasOwnProperty(id)) {
          this.sockets[id].disconnect()
        }
        delete this.sockets[id]
      }
    }

    disconnectClient (id) {
      if (this.sockets.hasOwnProperty(id)) {
        this.sockets[id].disconnect()
      }
      delete this.sockets[id]
    }

    removeIdleSocketsFromStorage () {
      const self = this
      return new Promise(async function (resolve, reject) {
        let totalToLeave = 0
        let totalToLeft = 0
        let int = null
        try {
          const { error, clients } = await self.getSocketClients()
          if (error) {
            return reject(error)
          }

          const cr = await self.getChannelsOnStorage()
          if (cr.error) {
            return reject(cr.error)
          }

          cr.channels.forEach((channel) => {
            channel.people.forEach((socket) => {
              if (clients[socket.id] === undefined) {
                totalToLeave += 1
              }
            })
          })
          cr.channels.forEach((channel) => {
            channel.people.forEach(async (socket) => {
              // console.log(socket.id, clients)
              if (clients[socket.id] === undefined) {
                await self.leaveChannelOnStorage(socket.channel, socket)
                totalToLeft += 1
              }
            })
          })
          int = setInterval(() => {
            if (totalToLeft === totalToLeave) {
              resolve(true)
              clearInterval(int)
            }
          }, 500)
        } catch (e) {
          // statements
          // console.log(e);
          reject(e)
        }
      })
    }

    removeIdleSocketsFromChannel (channelName) {
      const self = this
      return new Promise(async function (resolve, reject) {
        let totalToLeave = 0
        let totalToLeft = 0
        let int = null
        const channelToleave = null
        try {
          const { error, clients } = await self.getSocketClients()
          if (error) {
            return reject(error)
          }

          const cr = await self.getChannelsOnStorage({ name: channelName })
          if (cr.error) {
            return reject(cr.error)
          }
          console.log('cr.channels', cr.channels)
          if (cr.channels[0]) {
            const channel = cr.channels[0]
            if (channel.people) {
              channel.people.forEach((socket) => {
                if (clients[socket.id] === undefined) {
                  totalToLeave += 1
                }
              })
              channel.people.forEach(async (socket) => {
                // console.log(socket.id, clients)
                if (clients[socket.id] === undefined) {
                  await self.leaveChannelOnStorage(channel.name, socket)
                  totalToLeft += 1
                }
              })
            }
          }

          int = setInterval(() => {
            if (totalToLeft === totalToLeave) {
              resolve(true)
              clearInterval(int)
            }
          }, 500)
        } catch (e) {
          // statements
          // console.log(e);
          reject(e)
        }
      })
    }

    async executeOnConnection (socket) {
      const self = this
      try {
        await self.removeIdleSocketsFromStorage()
      } catch (e) {
        // statements
        // console.log('>>>>>>>>>>> 11111111', e);
        return false
      }
      // console.log(socket.handshake.query)
      const name = socket.handshake.query.name
      const userId = socket.handshake.query.userId
      const companyId = socket.handshake.query.companyId + ''
      const user_personal_room_name = getPersonalRoomName(userId, companyId)
      const currentUser = {
        id: socket.id,
        name: name,
        userId: userId,
        companyId: '' + companyId,
        // browser : socket.request.headers,
        channel: user_personal_room_name
      }

      self.console.session(name, userId, companyId, socket)

      socket.on('disconnect', async () => {
        await self.executeOnDisconnect(
          socket,
          currentUser,
          user_personal_room_name
        )
        // console.log('disconnected');
      })

      if (!validName(currentUser.name)) {
        // console.log('not valid', currentUser.name)
        socket.disconnect()
        return
      }

      try {
        const isSocketOnline = await self.isSocketOnline(currentUser)
        if (isSocketOnline.error) {
          // console.log('cant join check if socket client is already online')
          socket.disconnect()
          return
        }
        // console.log(1)
        if (isSocketOnline.isOnline) {
          // console.log('isOnline isOnline', isSocketOnline.isOnline)
          socket.disconnect()
          return
        }
        // console.log(2)
        const setSocketOnline = await self.setSocketOnline(currentUser)
        if (setSocketOnline.error) {
          // console.log('cant set socket online')
          socket.disconnect()
          return
        }
        // console.log(3)
        const joinSocketToPersonalRoom = await self.joinSocketToPersonalRoom(
          currentUser,
          user_personal_room_name
        )
        if (joinSocketToPersonalRoom.error) {
          // console.log('cant join personal room')
          socket.disconnect()
          return
        }
        // console.log(4)
        /* SocketIOAuth(socket,
                    {
                        authenticate : function(socket, data, callback)
                        {
                            //get credentials sent by the client
                            /*var username = data.username
                            var password = data.password
                            db.findUser('User',
                            {
                                username : username
                            }, function(err, user)
                            {

                                //inform the callback of auth success/failure
                                if (err || !user) return callback(new Error("User not found"))
                                return callback(null, user.password === password)
                            })
                            //return callback(null, true)
                        },
                        //postAuthenticate: postAuthenticate,
                        //disconnect: disconnect,
                        //frooms.jointimeout: 1000
                    }) */

        self.sockets[currentUser.id] = socket
        self.socket = socket

        self.setSocketServices(socket, currentUser, user_personal_room_name)

        // send message history to user
        // send agency global messages to user
        // send servers announcements to user
        const { error, messages } = await self.getNotReceivedMessages(currentUser)
        if (!error && messages.length > 0) {
          messages.forEach((envelop) =>
            self.io.of('/').to(currentUser.channel).emit(envelop.type, envelop)
          )
        }

        self.console.notice(' User ' + currentUser.name + ' connected!')
      } catch (e) {
        // statements
        // console.log(e);
        return socket.disconnect()
      }
    }

    async setSocketLayer () {
      const self = this
      const error = null
      // console.log('>>>>>>>>>')

      return new Promise(async function (resolve, reject) {
        try {
          await self.removeIdleSocketsFromStorage()
        } catch (e) {
          // statements
          // console.log(e);
          return resolve(false)
        }

        self.io.on('connection', async (socket) => {
          await self.executeOnConnection(socket)
          resolve(true)
        })
      })
    }

    setSocketServices (socket, user, room) {
      const self = this
      socket.on('ding', () => {
        // console.log('dinggggggg')
        socket.emit('dong')
      })

      socket.on('agency:message:global:send', async (data) => {
        const envelop = self.envelop.newScAgencyGlobalMessage({
          uuid: data.uuid,
          from: user,
          message: data.message
        })
        const d = await self.$models.mongoose.SocketMessage.create(envelop)
        await self.sendToAll(socket, 'agency:message:global:receive', envelop)
      })

      socket.on('server:announcement:send', async (data) => {
        await self.sendToAll(socket, 'server:announcement:receive', data)
      })

      socket.on('server:client:list:send', async (data) => {
        // console.log('--->>>>>> server:client:list:send')
        await self.getAllClientsList(socket, data, user)
      })

      socket.on('message:acknowledgment:send', async (data) => {
        try {
          await self.setMessageAcknowledgment(data)
        } catch (e) {
          // console.log(e)
        }
      })

      socket.on('talk:private:send', async (data) => {
        try {
          await self.sendPrivateMessage(
            socket,
            'talk:private:receive',
            user,
            data
          )
        } catch (e) {
          // console.log(e)
        }
      })

      socket.on('channel:before:join', async (data) => {
        // console.log('channel:before:join')
        const r = await self.joinChannel(socket, 'channel:after:join', data)
        // console.log('joinChannel response', r)
      })
    }

    async getUserBySocketId (sockedId) {
      const self = this
      let found = 404
      let users = null
      // console.log('getUserBySocketId', sockedId)
      try {
        users = await self.getOnlineUsersFromStorage()
        users.forEach((u) => {
          // console.log(u.id, sockedId)
          if (u.id === sockedId) {
            // console.log( 'uuuuuuuuuuuuuuuuuuuuu', u)
            found = u
          }
        })
        return found
      } catch (e) {
        throw Error(e)
        return e
      }
    }

    getAllClients () {
      const self = this
      this.io.of('/').adapter.clients((err, clients) => {
        if (err) {
          // error handling
          // console.log(err)
        }
        self.console.notice(' Total users: ' + clients.length + ' in all rooms')
      })
    }

    getSocketClients () {
      const self = this
      return new Promise(async function (resolve, reject) {
        const response = { error: null, clients: [] }
        self.io.of('/').adapter.clients((err, clients) => {
          if (err) {
            response.error = err
            return resolve(response)
          }
          response.clients = clients
          return resolve(response)
        })
      })
    }

    getAllRoomsUserIsJoined (user) {
      const self = this
      this.io.of('/').adapter.clientRooms(user.id, (err, rooms) => {
        if (err) {
          // error handling
          // console.log(err)
        }
        // console.log(rooms) // an array containing every room a given id has joined.
        self.console.notice(
          ' ' +
            chalk.underline.blue(user.name) +
            ' is joined into following rooms: ',
          rooms
        )
      })
    }

    getUserNumberOfConnectedClients (user, room) {
      const self = this
      // this.console.notice(' Total users on memory: ' + this.users.length)
      // check number of clients connected for same user
      this.io.of('/').adapter.clients([room], (err, clients) => {
        if (err) {
          // error handling
          // console.log(err)
        }
        self.console.notice(
          ' Number of connected clients for user ' +
            user.name +
            ': ' +
            (clients ? clients.length : 0)
        )
      })
    }

    getAllClientsList (socket, data, user) {
      const self = this
      const connectedUsers = []
      let users = null

      user = user || self.getServerUser()
      // console.log('getAllClientsList---->>>>>>>>>')
      return new Promise(async function (resolve, reject) {
        try {
          const { error, socketClients } = await self.getConnectedSockets()
          // console.log({ error, socketClients})
          if (error) {
            self.console.error(error)
            reject(error)
            return
          }
          users = await self.getOnlineUsersFromStorage()
          // console.log('users', users)
          // console.log('socketClients', socketClients)
          socketClients.forEach((id) => {
            for (let x = 0; x < users.length; x++) {
              if (users[x].id === id) {
                connectedUsers.push(users[x])
                break
              }
            }
          })
          socket.emit(
            'server:client:list:receive',
            self.envelop.newScClientsList({
              from: user,
              ids: socketClients,
              users: connectedUsers
            })
          )
          resolve(connectedUsers)
        } catch (e) {
          // console.log(e)
          reject(e)
        }
      })
    }

    getConnectedSockets () {
      const self = this
      return new Promise(async function (resolve, reject) {
        const response = { error: null, socketClients: [] }

        self.io.of('/').adapter.clients(async (err, socketClients) => {
          if (err) {
            self.console.error(err.message)
            response.error = err
            return reject(response)
          }
          response.socketClients = socketClients
          return resolve(response)
        })
      })
    }

    getConnectedClientsOfUser (user) {
      const self = this
      let onlineClientsOfUser = []
      let users = null

      return new Promise(async function (resolve, reject) {
        try {
          const { error, socketClients } = await self.getConnectedSockets()
          users = await self.getOnlineUsersFromStorage()
          if (users) {
            onlineClientsOfUser = users.filter((u) => {
              return (
                u.userId.toString() === user.userId.toString() &&
                socketClients.indexOf(u.id) > -1
              )
            })
            /* users.forEach((u) =>
                    {
                        // console.log(`       socketClients.indexOf( u.id )`, socketClients.indexOf( u.id ))
                        // double check if user is online on socket and Redis
                        if ((u.userId.toString() === user.userId.toString()) && (socketClients.indexOf(u.id) > -1)) {
                            onlineClientsOfUser.push(u)
                        }
                    }) */
            // console.log(onlineClientsOfUser)
            return resolve(onlineClientsOfUser)
          }
          return reject('please provide a user')
        } catch (e) {
          // console.log(e);
          reject(e)
        }
      })
    }

    async executeOnDisconnect (socket, user, room) {
      const self = this
      // leave redis room - delete from store
      // leave SocketIo rooms
      // console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXX executeOnDisconnect', user.id)
      self.getAllClients()
      // console.log(user)
      await self.setSocketOffline(user)
      delete self.sockets[user.id]
      // console.log('emiting')
      socket.broadcast.emit(
        'user:disconnect',
        self.envelop.newScClientDisconnect({
          from: user
        })
      )
      self.console.notice(' User ' + user.name + ' disconnected!')

      // seems it is automatically executing remoteLeave
      /* self.io
            .of('/')
            .adapter
            .remoteLeave(user.id, room, (err) => {
                if (err) {
                    // console.log(chalk.underline.bold.red('[ERROR]') + ' ' + err.message)
                    //return
                }

            }) */
    }

    sendToAll (socket, eventName, data) {
      const self = this
      return new Promise(async function (resolve, reject) {
        // socket.broadcast.emit(eventName, data)

        self.io.of('/').emit(eventName, data)

        resolve(eventName, data)
      })
    }

    joinChannel (socket, eventName, data) {
      // console.log('joinChannel')
      // console.log(eventName)
      // console.log(data)
      const self = this
      return new Promise(async function (resolve, reject) {
        let user_connected_clients = []
        const envelop = null
        let joined_talk = false
        let joined_storage_channel = false
        let error = null
        const channel = null
        // console.log('# user_connected_clients: ', user_connected_clients.length)
        // console.log('user_connected_clients: ', user_connected_clients)

        const rGCS = await self.getChannelOnStorage(data.channel)
        if (rGCS.error) {
          // channel does  not exist
          user_connected_clients = await self.getConnectedClientsOfUser(
            data.from
          )

          joined_storage_channel = await self.createChannelOnStorage({
            name: data.channel,
            type: 'talk', // 'talk', personal, group
            people: user_connected_clients,
            person: data.from
          })
          if (joined_storage_channel.error) {
            error = joined_storage_channel.error
          } else {
            user_connected_clients.forEach(async (user) => {
              joined_talk = await self.joinSocketIoChannel(
                socket,
                data.channel,
                user
              )
              self.io
                .of('/')
                .to(user.id)
                .emit('channel:after:join', joined_storage_channel.channel)
            })

            // envelop.people = joined_storage_channel.people
            // console.log('channel:after:join', envelop)

            // self.io
            //    .of('/')
            //        .to( data.channel )
            //            .emit( 'channel:after:join', envelop )
          }

          resolve({ error, channel: joined_storage_channel.channel })
        } else {
          // channel already exist
          let alreadyJoined = false
          rGCS.channel.people.forEach((p) => {
            if (p.id === data.from.id) {
              alreadyJoined = true
            }
          })

          if (!alreadyJoined) {
            console.log('going to joinUserChannelOnStorage')

            user_connected_clients = await self.getConnectedClientsOfUser(
              data.from
            )

            const responseJoin = self.joinUserChannelOnStorage(
              data.channel,
              data.from
            )
            if (responseJoin.error) {
              return resolve({ error: responseJoin.error, channel: null })
            }

            self.channels.forEach((ch, i) => {
              if (ch.name === data.channel) {
                self.channels[i] = responseJoin.channel
              }
            })
          }

          // await self.removeIdleSocketsFromChannel(data.channel)
        }

        // join to redis and socketIo Channels if necessary
        user_connected_clients.forEach(async (user) => {
          try {
            joined_storage_channel = await self.joinChannelOnStorage(
              data.channel,
              user,
              'talk'
            )
            if (joined_storage_channel.error) {
              error = joined_storage_channel.error
            } else {
              joined_talk = await self.joinSocketIoChannel(
                socket,
                data.channel,
                user
              )
              // envelop.people = joined_storage_channel.people
              // console.log('channel:after:join', envelop)
              self.io
                .of('/')
                .to(user.id)
                .emit('channel:after:join', joined_storage_channel)
              // self.io
              //    .of('/')
              //        .to( data.channel )
              //            .emit( 'channel:after:join', envelop )
            }
            // error = null;
          } catch (e) {
            // statements
            error = e
          }
        })

        resolve({ error, channel: data.channel })
      })
    }

    async sendPrivateMessage (socket, eventName, user, data) {
      const self = this
      let from_participants = []
      let to_participants = []
      let participants = []
      let doc = null
      const envelop = self.envelop.newScPrivateMessage({
        from: data.from,
        to: data.to,
        message: data.message,
        uuid: data.uuid,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      })

      try {
        // me participants
        from_participants = await self.getConnectedClientsOfUser(data.from)

        // to participants
        to_participants = await self.getConnectedClientsOfUser(data.to)

        participants = from_participants.concat(to_participants)

        for (let x = 0; x < participants.length; x++) {
          const user = participants[x]
          // console.log(' user ', user)
          socket.to(user.id).emit(eventName, envelop)
        }

        envelop.sent = false // let set sent as true when receive confirmation from client

        doc = await self.$models.mongoose.SocketMessage.create(envelop)

        return { error: null, data, envelop }
      } catch (err) {
        // reject(err)
        console.error(err)
        return { error: err, data: null, envelop: null }
      }
    }

    setMessageAcknowledgment (data) {
      const self = this
      let from = {}
      let read = false
      return new Promise(async function (resolve, reject) {
        const resultDocument = await self.$models.mongoose.SocketMessage.findOne(
          {
            uuid: data.uuid
          }
        )

        if (resultDocument) {
          from = data.from
          resultDocument.read.forEach((client) => {
            if (client.userId.toString() === from.userId.toString()) {
              read = true
            }
          })

          if (!read) {
            delete from.id

            resultDocument.read.push(from)
            resultDocument.sent = true
            // console.log( 'resultDocument.updatedAt ',  resultDocument.updatedAt)
            // console.log( 'setMessageAcknowledgment ',  data.updatedAt)
            resultDocument.updatedAt = data.updatedAt
            // console.log( 'resultDocument.updatedAt ',  resultDocument.updatedAt)
            resultDocument.save(function (err, document) {
              if (err) {
                reject(err)
                return console.error(err)
              }

              self.sendServerReceipt(resultDocument, from)

              self.sendAcknowledgment(resultDocument, from)

              resolve(resultDocument.read)
            })
          } else {
            reject('receipt already confirmed')
          }
        } else {
          reject('message not found')
        }
      })
    }

    sendServerReceipt (message, from) {
      const self = this
      const eventName = 'message:server:receipt'
      let envelop = {}
      let clients_of_user = []
      const participants = []

      return new Promise(async function (resolve, reject) {
        clients_of_user = await self.getConnectedClientsOfUser(from)
        clients_of_user.forEach((client) => participants.push(client))

        envelop = {
          from: from,
          uuid: message.uuid,
          message: 'Server receipt the message ' + message.uuid,
          updatedAt: message.updatedAt
        }

        // console.log( 'sendServerReceipt ',  message.updatedAt)

        for (let x = 0; x < participants.length; x++) {
          const user = participants[x]
          // console.log( ' user ', user.name + " - " + user.id )
          self.io.of('/').to(user.id).emit(eventName, envelop)
        }
        resolve(from)
      })
    }

    sendAcknowledgment (message, from) {
      const self = this
      const eventName = 'message:acknowledgment:receive'
      let envelop = {}
      let clients_of_user = []
      const participants = []

      return new Promise(async function (resolve, reject) {
        for (let x = 0; x < message.people.length; x++) {
          const person = message.people[x]
          clients_of_user = await self.getConnectedClientsOfUser(person)
          clients_of_user.forEach((client) => participants.push(client))
        }

        envelop = {
          from: from,
          uuid: message.uuid,
          message: from.name + ' read the message ' + message.uuid,
          updatedAt: message.updatedAt
        }

        // console.log( 'sendAcknowledgment ',  message.updatedAt)

        for (let x = 0; x < participants.length; x++) {
          const user = participants[x]
          // console.log( ' user ', user.name + " - " + user.id )
          self.io.of('/').to(user.id).emit(eventName, envelop)
        }
        resolve(from)
      })
    }

    async getNotReceivedMessages (user) {
      const self = this
      let error = null
      let messages = []

      try {
        messages = await self.$models.mongoose.SocketMessage.find({
          sent: false,
          'to.userId': user.userId
        })
      } catch (e) {
        error = e
        // console.log(e)
      }

      return { error, messages }
    }

    async setSocketOnline (socket) {
      const self = this
      let error = null
      try {
        const users = await self.getOnlineUsersFromStorage()
        const index = findIndex(users, 'id', socket.id)
        if (index === -1) {
          // console.log('XXXXXXXX->>', socket)
          users.push(socket)
          self.redis.store.set(
            self.config.app.onLineUsersStorageName,
            JSON.stringify(users)
          )
          self.users = users
        }
      } catch (e) {
        // statements
        // console.log(e)
        error = e
      }
      return { error, users: self.users }
    }

    async setSocketOffline (socket) {
      const self = this
      let error = null
      try {
        const users = await self.getOnlineUsersFromStorage()
        const foundIndex = findIndex(users, 'id', socket.id)
        if (foundIndex > -1) {
          users.splice(foundIndex, 1)
        }
        self.redis.store.set(
          self.config.app.onLineUsersStorageName,
          JSON.stringify(users)
        )
        self.users = users
      } catch (e) {
        // statements
        // console.log(e);
        error = e
      }
      return { error, users: self.users }
    }

    async isSocketOnline (socketId) {
      const self = this
      let isOnline = false
      let error = null
      try {
        const { user, error } = await this.getOnlineUserFromStorage(socketId)
        // console.log('user', user)
        if (!!user && !error) {
          isOnline = true
        }
      } catch (e) {
        isOnline = false
        error = e
        self.console.error(e.message)
        // console.log(e);
      }
      return { isOnline, error }
    }

    async getOnlineUserFromStorage (socketId) {
      const self = this
      let user = false
      let error = null

      try {
        const users = await this.getOnlineUsersFromStorage()
        self.users = users
        const index = findIndex(self.users, 'id', socketId)
        if (index > -1) {
          user = self.users[index]
        }
      } catch (e) {
        error = e
        self.console.error(e.message)
        // console.log(e);
      }
      return { user, error }
    }

    getOnlineUsersFromStorage () {
      const self = this
      return new Promise(function (resolve, reject) {
        self.redis.store.get(self.config.app.onLineUsersStorageName, function (
          err,
          users
        ) {
          if (err) {
            self.console.error(err.message)
            reject(err)
          }
          // console.log('getOnlineUsersFromStorage', users)
          try {
            users = users || '[]'
            users = JSON.parse(users)
            resolve(users)
          } catch (e) {
            // console.log(e);
            reject(e)
          }
        })
      })
    }

    async createChannelOnStorage (c) {
      const self = this
      try {
        // console.log('createChannelOnStorage', c)
        let _channel = new $channel(c)
        _channel.owner = c.person.userId
        // console.log(_channel)
        _channel = JSON.parse(JSON.stringify(_channel))
        const channel = await self.$models.mongoose.SocketChannel.create(_channel)
        /* channel.people.forEach( person => {
                let envelop = self.envelop.newScAgencyGlobalMessage(
                {
                    from : user,
                    message : data.message,
                })
                self.io
                    .of('/')
                    .to(person.id)
                    .emit('channel:after:create', envelop)
            } ) */
        self.channels.push(channel)
        return { error: null, channel }
      } catch (e) {
        // statements
        // console.log(e);
        return { error: e, channel: null }
      }
    }

    async getChannelsOnStorage (where = {}) {
      const self = this
      try {
        const channels = await self.$models.mongoose.SocketChannel.find(where)
        // console.log('channel', channels)
        return { error: null, channels }
      } catch (e) {
        // console.log(e);
        return { error: e, channels: null }
      }
    }

    async getChannelOnStorage (name = '') {
      const self = this
      try {
        // console.log('-----------------------', name)
        const channel = await self.$models.mongoose.SocketChannel.findOne({
          name
        })
        // { error:// console.log('channel', channel)
        if (!channel) {
          return { error: 'channel not found', channel: null }
        }
        return { error: null, channel }
      } catch (e) {
        // console.log(e);
        return { error: e, channel: null }
      }
    }

    async joinUserChannelOnStorage (name = false, user = false) {
      const self = this
      const query = {
        name
      }
      const options = {
        new: true
      }
      if (!user) {
        return { error: 'user is missing', channel: null }
      }
      if (!name) {
        return { error: 'name is missing', channel: null }
      }
      try {
        const channel = await self.$models.mongoose.SocketChannel.findOneAndUpdate(
          query,
          { $push: { people: user } },
          options
        )
        if (!channel) {
          return { error: 'channel not found', channel: null }
        }
        return { error: null, channel }
      } catch (e) {
        // console.log(e);
        return { error: e, channel: null }
      }
    }

    async updateUserChannelOnStorage (name = false, channelO = false) {
      const self = this
      const query = {
        name
      }
      const options = {
        new: true
      }
      if (!channelO) {
        return { error: 'channel is missing', channel: null }
      }
      if (!name) {
        return { error: 'name is missing', channel: null }
      }
      try {
        const channel = await self.$models.mongoose.SocketChannel.findOneAndUpdate(
          query,
          channelO,
          options
        )
        if (!channel) {
          return { error: 'channel not found', channel: null }
        }
        return { error: null, channel }
      } catch (e) {
        // console.log(e);
        return { error: e, channel: null }
      }
    }

    async joinChannelOnStorage (name, person, type) {
      const _person = copy(person)
      const action = ''

      delete _person.browser

      const self = this
      let alreadyJoined = false

      try {
        const { error, channel } = await self.getChannelOnStorage(name)
        // console.log({ error, channel })
        // if(error) return { error, channel: null}
        if (!channel) {
          console.log('creating channel')
          const rc = await self.createChannelOnStorage({
            name: name,
            type: type, // 'talk', personal, group
            people: [_person],
            person: person
          })
          if (rc.error) {
            return { error: rc.error, channel: null }
          }
          return { error: null, channel: rc.channel }
        }
        console.log('channel already exists')
        // if channel exist
        channel.people.forEach((p) => {
          if (p.id === person.id) {
            alreadyJoined = true
          }
        })

        if (!alreadyJoined) {
          console.log('going to joinUserChannelOnStorage')
          const rr = self.joinUserChannelOnStorage(name, _person)
          if (rr.error) {
            return { error: rr.error, channel: null }
          }

          self.channels.forEach((ch, i) => {
            if (ch.name === name) {
              self.channels[i] = channel
            }
          })
        }

        // console.info(self.channels)

        return { error: null, channel }
      } catch (e) {
        // statements
        // console.log(e);
        return { error: e, channel: null }
      }
    }

    async leaveChannelOnStorage (channelName, person) {
      // console.log('leaveChannelOnStorage channelName', channelName)
      // console.log('leaveChannelOnStorage person', person)
      const self = this
      const left = false

      try {
        let { error, channel } = await self.getChannelOnStorage(channelName)
        if (!channel) {
          throw 'channel not found'
        }
        channel = copy(channel)
        // console.log('leaveChannelOnStorage channel.people', channel.people)
        channel.people.forEach((p, index) => {
          if (p.id === person.id) {
            channel.people.splice(index, 1)
          }
        })
        // console.log('leaveChannelOnStorage channel.people', channel.people)
        const rr = await self.updateUserChannelOnStorage(channelName, channel)
        if (rr.error) {
          throw rr.error
        }
        if (rr.error) {
          throw 'channel not found when updating'
        }
        self.channels.forEach((channel, cindex) => {
          channel.people.forEach((p, index) => {
            if (p.id === person.id) {
              self.channels[cindex].people.splice(1, index)
            }
          })
        })

        return { error, channel: rr.channel, user: rr.channel }
      } catch (e) {
        // statements
        // console.log(e);
        return { error: e, channel: null }
      }
    }

    joinSocketIoChannel (socket, room, user) {
      // console.log('joinSocketIoChannel >>>>>>>>>>>>')
      const self = this
      const found = 404
      const users = null
      return new Promise(async function (resolve, reject) {
        self.io.of('/').adapter.remoteJoin(user.id, room, (err, a, b) => {
          if (err) {
            // console.log(chalk.underline.bold.red('[ERROR]') + ' ' + err.message)
            reject(err)
            return
          }
          // console.log('remoteJoin >>>>>>>>>>>>')
          socket.join(room, (errr) => {
            if (errr) {
              // console.log(chalk.underline.bold.red('[ERROR]') + ' ' + errr.message)
              reject(errr)
              return
            }
            self.io.of('/').to(room).emit('user:join', {
              name: user.name,
              user: user,
              room: room
            })
            // console.log('socket.join >>>>>>>>>>>>')
            resolve(true)
          })
        })
      })
    }

    // single user multiple clients
    joinSocketToPersonalRoom (user, room, callback) {
      // console.log('joinSocketToPersonalRoom >>>>>>>>>>>> user', user)
      // console.log('joinSocketToPersonalRoom >>>>>>>>>>>> room', room)
      const self = this
      return new Promise(function (resolve, reject) {
        const response = { error: null, joined: false }
        // then if we need to send messages to multiple same client, we send to this room
        self.io.of('/').adapter.remoteJoin(user.id, room, async (err) => {
          if (err) {
            // console.log(err)
            response.error = err
            return resolve(response)
          }

          try {
            const joined_storage_channel = await self.joinChannelOnStorage(
              room,
              user,
              'personal'
            )
            // console.log('joined_storage_channel', joined_storage_channel)
            if (joined_storage_channel.error) {
              // console.log(joined_storage_channel.error)
              response.error = joined_storage_channel.error
              return resolve(response)
            }
            // if(joined_storage_channel.channel)
            //  to everyone
            const envelop = {
              name: user.name,
              user: user,
              room: room,
              channel: joined_storage_channel.channel
            }
            self.io.emit('user:join', envelop)

            self.io
              .of('/')
              .to(user.id)
              .emit('channel:after:join:personal', envelop)

            self.getUserNumberOfConnectedClients(user, room)
            self.getAllRoomsUserIsJoined(user)
            self.getAllClients()
            self.getAllRooms()
            response.joined = true
            resolve(response)
          } catch (e) {
            // statements
            response.joined = false
            // console.log(e);
            resolve(response)
          }
        })
      })
    }

    getAllRooms () {
      const self = this
      self.io.of('/').adapter.allRooms((err, rooms) => {
        if (err) {
          // error handling
          // console.log(err)
        }
        // an array containing all rooms (accross every node)
        self.console.notice(' All available rooms in stack are:', rooms)
      })
    }
  }

export default MessageMediator
