'use strict'

import {
  _setCacheKeyName,
  _setPagingLimit,
  _setPagingOffset,
  _setPagingSort,
  _setPipeline,
  _setQueryFilters,
  _setQueryPopulate,
  _setQuerySelect,
  _setWhere,
  isArray,
  isDefined,
  isNumber,
  isObject,
  sanitizePayload
} from '../util'

/** mixin representing the MongooseAPI. */
const MongooseAPI = (MongooseAPI) =>
  class extends MongooseAPI {
    async _createMongo (job) {
      const payload = sanitizePayload(job.payload, job)
      let error = false
      let record = false
      const userId = job.from.human._id
      if (userId !== '0' && userId !== 0) {
        payload.createdBy = userId
      }
      try {
        record = await this.application.$models.mongoose[this.entity].create(
          isArray(payload) ? payload : [payload]
        )
        this.application.clearKey(this.entity)
        const r = isArray(record) ? record[0] : record
        await this.addHistory({
          entity: this.entity,
          document_id: '' + r._id,
          document: JSON.parse(JSON.stringify(r)),
          version: r.__v,
          updatedBy: userId,
          // createdAt: 
        })
      } catch (err) {
        console.log(err.message, error)
        error = err
      }

      return {
        error,
        data: isArray(payload) ? record : record[0],
        status: error ? 500 : 201
      }
    }

    async _updateMongo (job) {
      job.payload = job.payload || {}
      const self = this
      const payload = sanitizePayload(job.payload, job)
      const primaryKeyValue = payload[self.primaryKeyName]
      const userId = job.from.human._id
      let error = false
      let record = false
      let data = false
      // session = null,
      const query = {
        _id: primaryKeyValue
      }
      const options = {
        new: true
      }

      payload.updatedAt = new Date(Date.now()).toString()
      if (userId !== '0' && userId !== 0) {
        payload.updatedBy = userId
      }

      // session = await self.application.$db.startSession();
      // session.startTransaction()

      try {
        record = await self.application.$models.mongoose[self.entity].findById(
          primaryKeyValue
        )
        if (!record) {
          // await session.abortTransaction()
          return {
            error: `Record not found on Mongo ${self.entity} collection`,
            status: 404
          }
        }

        if (record.deleted) {
          // await session.abortTransaction()
          return {
            error: 'Record is deleted and can not be updated',
            status: 404
          }
        }

        data = await self.application.$models.mongoose[
          self.entity
        ].findOneAndUpdate(query, payload, options)

        self.application.clearKey(self.entity)

        /* for (let prop in payload) {
                record[prop] = payload[prop]
            }

            data = await record.save({
                session: session
            }) */

        // save record history
        /* await self.application.$models.mongoose.History.create([
          {
            entity: self.entity,
            document_id: record._id,
            document: record,
            version: record.__v,
            updatedBy: userId
          }
        ]) */

        // await session.commitTransaction()
        // session.endSession()
      } catch (err) {
        console.log(err.message, error)
        error = err
        // await session.abortTransaction()
        // session.endSession()
      }

      return {
        error,
        data,
        status: error ? 500 : 200
      }
    }

    async _addFileMongo (job) {
      job.payload = job.payload || {}
      const self = this

      // using promisse instead async and await due a concurrency issue when calling model.save()
      return new Promise(async function (resolve, reject) {
        const payload = job.payload
        const primaryKeyValue = payload[self.primaryKeyName]
        const userId = job.from.human._id
        const str = null
        const obj = null
        let error = false
        const record = false
        let data = false
        // console.log('job', job)
        if (!job.payload[self.primaryKeyName]) {
          return resolve({
            error: `Payload must have an ${self.primaryKeyName} to call findById`,
            status: 400
          })
        }
        if (!isDefined(job.from.human._id)) {
          return resolve({
            error: 'job.from.human._id must be provided',
            status: 400
          })
        }

        self.application.$models.mongoose[self.entity].findById(
          primaryKeyValue,
          (err, record) => {
            if (err) {
              self.application.console.warn(err)
              return resolve({
                error: err,
                status: 400
              })
            }
            if (typeof record === 'undefined') {
              return resolve({
                error: `Record not found on Mongo  ${primaryKeyValue} ${self.entity} collection`,
                status: 404
              })
            }
            if (record === null) {
              return resolve({
                error: `Record not found on Mongo ${primaryKeyValue} ${self.entity} collection`,
                status: 404
              })
            }
            if (record.deleted) {
              return resolve({
                error: 'Record is deleted and can not be updated',
                status: 404
              })
            }

            record.updatedAt = new Date(Date.now()).toString()
            if (userId !== '0' && userId !== 0) {
              record.updatedBy = userId
            }

            // console.log('payload.file', payload.file)
            record.file.push(payload.file)
            record.save((e) => {
              // console.log(e, record)
              if (e) {
                error = e
              } else {
                data = record
                self.application.clearKey(self.entity)
              }
              resolve({
                error,
                data,
                status: error ? 400 : 200
              })
            })
          }
        )
      })
    }

    async _deleteMongo (job) {
      job.payload = job.payload || {}

      const self = this
      const primaryKeyValue = job.payload[self.primaryKeyName]
      const userId = job.from.human._id
      const str = null
      let obj = null
      let error = false
      let record = false
      let data = false
      const payload = {
        deleted: true,
        active: false,
        updatedAt: new Date(Date.now()).toString(),
        updatedBy: userId
      }
      const query = {
        _id: primaryKeyValue
      }
      const options = {
        new: true
      }

      if (!job.payload[self.primaryKeyName]) {
        return {
          error: `Payload must have an ${self.primaryKeyName} to call findById`,
          status: 400
        }
      }
      if (!isDefined(job.from.human._id)) {
        return {
          error: 'job.from.human._id must be provided',
          status: 400
        }
      }
      // session = await self.application.$db.startSession();
      // session.startTransaction()

      try {
        record = await self.application.$models.mongoose[self.entity].findById(
          primaryKeyValue
        )
        if (!record) {
          // await session.abortTransaction()
          return {
            error: `Record not found on Mongo ${self.entity} collection`,
            status: 404
          }
        }

        if (record.deleted) {
          // await session.abortTransaction()
          return {
            error: 'Record is already deleted',
            status: 404
          }
        }

        data = await self.application.$models.mongoose[
          self.entity
        ].findOneAndUpdate(query, payload, options)

        self.application.clearKey(self.entity)

        /* obj = JSON.parse(JSON.stringify(record))

        await self.application.$models.mongoose.History.create([
          {
            entity: self.entity,
            document_id: obj._id,
            document: obj,
            version: obj.__v,
            updatedBy: userId
          }
        ]) */

        /*
                record.deleted = true
                record.active = false
                record.updatedAt = (new Date(Date.now())).toString()
                record.updatedBy = userId

                data = await record.save()
            */
      } catch (err) {
        console.log(err)
        // await session.abortTransaction()
        self.application.console.warn(err)
        error = err.message || err
      }

      return {
        error,
        data,
        status: error ? 400 : 200
      }
    }

    async _deleteHardMongo (job) {
      job.payload = job.payload || {}

      const self = this
      const primaryKeyValue = job.payload[self.primaryKeyName]
      const deletedBy = job.from.human._id
      let error = false
      const record = false
      let data = false
      // session = null;

      if (!job.payload[self.primaryKeyName]) {
        return {
          error: `Payload must have an ${self.primaryKeyName} to call findOneAndRemove`,
          status: 400
        }
      }

      // session = await self.application.$db.startSession()
      // session.startTransaction()

      try {
        data = await self.application.$models.mongoose[
          self.entity
        ].findOneAndRemove({ _id: primaryKeyValue })
        if (!data) {
          // await session.abortTransaction()
          return {
            error: `Record not found on Mongo ${self.entity} collection`,
            status: 404
          }
        }

        self.application.clearKey(self.entity)

        await self.application.$models.mongoose.Trash.create([
          {
            entity: self.entity,
            document_id: data._id,
            deletedBy,
            document: data
          }
        ])

        // await session.commitTransaction()
      } catch (err) {
        console.log(err)
        // await session.abortTransaction()
        self.application.console.warn(err)
        error = err.message || err
      }

      return {
        error,
        data,
        status: error ? 400 : 200
      }
    }

    async _restoreMongo (job) {
      job.payload = job.payload || {}

      const self = this
      const primaryKeyValue = job.payload[self.primaryKeyName]
      const userId = job.from.human._id
      const str = null
      let obj = null
      let error = false
      let record = false
      let data = false
      const payload = {
        deleted: false,
        active: true,
        updatedAt: new Date(Date.now()).toString(),
        updatedBy: userId
      }
      const query = {
        _id: primaryKeyValue
      }
      const options = {
        new: true
      }

      if (!job.payload[self.primaryKeyName]) {
        return {
          error: `Payload must have an ${self.primaryKeyName} to call findById`,
          status: 400
        }
      }

      // session = await self.application.$db.startSession()
      // session.startTransaction()

      try {
        record = await self.application.$models.mongoose[self.entity].findById(
          primaryKeyValue
        )
        if (!record) {
          // await session.abortTransaction()
          return {
            error: `Record not found on Mongo ${self.entity} collection`,
            status: 404
          }
        }
        if (!record.deleted) {
          // await session.abortTransaction()
          return {
            error: 'Record is not deleted',
            status: 400
          }
        }

        data = await self.application.$models.mongoose[
          self.entity
        ].findOneAndUpdate(query, payload, options)

        self.application.clearKey(self.entity)

        obj = JSON.parse(JSON.stringify(record))

        await self.application.$models.mongoose.History.create([
          {
            entity: self.entity,
            document_id: obj._id,
            document: obj,
            version: obj.__v,
            updatedBy: userId
          }
        ])

        /* record.deleted = false
            record.active = true
            record.updatedAt = (new Date(Date.now())).toString()
            record.updatedBy = userId
            data = await record.save()

            await session.commitTransaction() */
      } catch (err) {
        console.log(err)
        // await session.abortTransaction()
        self.application.console.warn(err)
        error = err.message || err
      }

      return {
        error,
        data,
        status: error ? 400 : 200
      }
    }

    async _getMongoRecordById (job) {
      job.payload = job.payload || {}
      const primaryKeyValue = job.payload[this.primaryKeyName] || false
      const populate = job.payload.populate || false
      const select = job.payload.select || false
      const collection =
          job.payload.collection || job.payload.entity || this.entity
      let error = false
      let data = false

      if (!isDefined(job.from.human._id)) {
        return {
          error: 'job.from.human._id must be provided',
          status: 400
        }
      }
      if (!job.payload[this.primaryKeyName]) {
        return {
          error: `Payload must have an ${this.primaryKeyName} to call _getMongoRecordById`,
          status: 400
        }
      }

      try {
        if (populate && !select) {
          data = await this.application.$models.mongoose[collection]
            .findById(primaryKeyValue)
            .populate(populate)
        } else if (!populate && select) {
          data = await this.application.$models.mongoose[collection]
            .findById(primaryKeyValue)
            .select(select)
        } else if (populate && select) {
          data = await this.application.$models.mongoose[collection]
            .findById(primaryKeyValue)
            .select(select)
            .populate(populate)
        } else {
          data = await this.application.$models.mongoose[collection].findById(
            primaryKeyValue
          )
        }
      } catch (err) {
        this.application.console.warn(err)
        error = err.message || err
      }

      if (data === null) {
        return {
          error: `Record not found on Mongo ${collection} collection`,
          status: 404
        }
      }

      return {
        error,
        data,
        status: error ? 400 : 200
      }
    }

    async _getAllMongo (job) {
      job.payload = job.payload || {}
      const self = this
      let where = {}
      let pipeline = false
      let populate = false
      let select = false
      let error = false
      let data = []
      let filters = {}
      let offset = 0
      const returnAll = !!job.payload.returnAll || false
      let limit = this.application.config.app.pagingDefaultLimit
      let sort = {
        createdAt: -1
      }
      let options = {}

      // try to get data
      try {
        pipeline = _setPipeline(job)
        if (pipeline) {
          if (isArray(pipeline)) {
            data = await this._getAllDocumentsAggregated(job, pipeline)
          } else {
            error = 'pipeline must be an array'
          }
        } else {
          where = _setWhere(job)

          // set paging limit
          limit = _setPagingLimit(job, limit)

          // set paging offset
          offset = _setPagingOffset(job, offset)

          // set query select
          select = _setQuerySelect(job, select)

          // set query populate
          populate = _setQueryPopulate(job, populate)

          // set query filters
          filters = _setQueryFilters(job, filters)

          // set paging sort
          sort = _setPagingSort(job, sort)

          // now set query options
          options = {
            offset,
            limit,
            sort
          }

          // exclude deleted documents
          where.deleted = false

          // return deleted documents if returnAll
          if (returnAll) {
            delete where.deleted
          }

          // return deleted documents if admin or agency user
          if (
            job.from.roles.indexOf('admin') > -1 ||
            job.from.roles.indexOf('agency') > -1
          ) {
            delete where.deleted
          }

          // set options .populate
          if (populate) {
            options.populate = populate
          }

          // set options.select
          if (select) {
            options.select = select
          }
          // if not return all docs
          if (returnAll) {
            data = await this._getAllDocuments(job, where, options)
          }
          // if should not return all docs
          else {
            data = await this._getAllDocumentsPaginated(job, where, options)
          } // END if should not return all docs
        }
      } catch (err) {
        // if is there an error getting data
        this.application.console.warn(err)
        error = err.message || err
      } // END try to get data

      if (data.docs) {
        return {
          error,
          data: data.docs || data,
          count: data.total || 0,
          total: data.total || 0,
          page: data.page || 0, //  {Number} - Only if specified or default page/offset values were used
          pages: data.pages || 0, //  Number} - Only if page specified or default page/offset values were used
          limit: data.limit || 10, //   data.limit - job.payload.limit || 0,
          offset: data.offset || 0, //   data.limit - job.payload.limit || 0,
          status: error ? 500 : 200,
          isCache: self.isCached
        }
      }
      return {
        error,
        data: data,
        count: data.length,
        total: data.length,
        page: 0, //  {Number} - Only if specified or default page/offset values were used
        pages: 0, //  {Number} - Only if page specified or default page/offset values were used
        limit: 10, //   data.limit - job.payload.limit || 0,
        offset: 0, //   data.limit - job.payload.limit || 0,
        status: error ? 500 : 200,
        isCache: self.isCached
      }
    }

    async _getOneMongo (job) {
      job.payload = job.payload || {}

      const self = this
      const where = job.payload.where || {}
      const populate = job.payload.populate || false
      const select = job.payload.select || false
      const collection =
          job.payload.collection || job.payload.entity || this.entity
      let error = false
      let data = false

      // exclude deleted documents
      where.deleted = false

      try {
        if (populate && !select) {
          data = await this.application.$models.mongoose[collection]
            .findOne(where)
            .populate(populate)
        } else if (!populate && select) {
          data = await this.application.$models.mongoose[collection]
            .findOne(where)
            .select(select)
        } else if (populate && select) {
          data = await this.application.$models.mongoose[collection]
            .findOne(where)
            .select(select)
            .populate(populate)
        } else {
          data = await this.application.$models.mongoose[collection].findOne(
            where
          )
        }
      } catch (err) {
        this.application.console.warn(err)
        error = err.message || err
      }

      if (data === null) {
        return {
          error: `Record not found on Mongo ${collection} collection`,
          status: 404
        }
      }

      return {
        error,
        data,
        status: error ? 400 : 200
      }
    }

    async _getAllDocuments (job, where, options) {
      let data = []
      const collection =
        job.payload.collection || job.payload.entity || this.entity
      if (this.isCached) {
        // get cache on redis
        // let redisData = await this.application.getRedisKey(_setCacheKeyName(this.isCachedBasedOnUser, job, where, options))

        const redisData = await this.application.getRedisHkey(
          collection,
          _setCacheKeyName(this.isCachedBasedOnUser, job, where, options)
        )
        if (redisData) {
          // if cache exists
          if (redisData.data !== null) {
            // parse cached string as JSON
            data = JSON.parse(redisData.data)
          } else {
            // get data from Mongo
            data = await this.application.$models.mongoose[collection].find(
              where
            )
            // save cache
            // this.application.redis.store.setex(_setCacheKeyName(this.isCachedBasedOnUser, job, where, options), this.cacheExpiresIn, JSON.stringify(data))

            this.application.redis.store.hset(
              collection,
              _setCacheKeyName(this.isCachedBasedOnUser, job, where, options),
              JSON.stringify(data)
            )
            this.application.redis.store.expire(collection, this.cacheExpiresIn)
          }
        } else {
          // get data from Mongo
          data = await this.application.$models.mongoose[collection].find(where)
          // save cache
          // this.application.redis.store.setex(_setCacheKeyName(this.isCachedBasedOnUser, job, where, options), this.cacheExpiresIn, JSON.stringify(data))

          this.application.redis.store.hset(
            collection,
            _setCacheKeyName(this.isCachedBasedOnUser, job, where, options),
            JSON.stringify(data)
          )
          this.application.redis.store.expire(collection, this.cacheExpiresIn)
        }
      }
      // if this entity is not cached
      else {
        // get data from Mongo
        data = await this.application.$models.mongoose[collection].find(where)
      }
      return data
    }

    async _getAllDocumentsAggregated (job, pipeline, options = {}) {
      let data = []
      const collection =
        job.payload.collection || job.payload.entity || this.entity
      if (this.isCached) {
        // get cache on redis
        // let redisData = await this.application.getRedisKey(_setCacheKeyName(this.isCachedBasedOnUser, job, pipeline, options))

        const redisData = await this.application.getRedisHkey(
          collection,
          _setCacheKeyName(this.isCachedBasedOnUser, job, pipeline, options)
        )

        if (redisData) {
          // if cache exists
          if (redisData.data !== null) {
            // parse cached string as JSON
            data = JSON.parse(redisData.data)
          } else {
            // get data from Mongo
            data = await this.application.$models.mongoose[
              collection
            ].aggregate(pipeline)
            // save cache
            // this.application.redis.store.setex(_setCacheKeyName(this.isCachedBasedOnUser, job, pipeline, options), this.cacheExpiresIn, JSON.stringify(data))

            this.application.redis.store.hset(
              collection,
              _setCacheKeyName(
                this.isCachedBasedOnUser,
                job,
                pipeline,
                options
              ),
              JSON.stringify(data)
            )
            this.application.redis.store.expire(collection, this.cacheExpiresIn)
          }
        } else {
          // get data from Mongo
          data = await this.application.$models.mongoose[collection].aggregate(
            pipeline
          )
          // save cache
          // this.application.redis.store.setex(_setCacheKeyName(this.isCachedBasedOnUser, job, pipeline, options), this.cacheExpiresIn, JSON.stringify(data))

          this.application.redis.store.hset(
            collection,
            _setCacheKeyName(this.isCachedBasedOnUser, job, pipeline, options),
            JSON.stringify(data)
          )
          this.application.redis.store.expire(collection, this.cacheExpiresIn)
        }
      }
      // if this entity is not cached
      else {
        // get data from Mongo

        data = await this.application.$models.mongoose[collection].aggregate(
          pipeline
        )
      }
      return data
    }

    async _getAllDocumentsPaginated (job, where, options = {}) {
      let data = []
      const collection =
        job.payload.collection || job.payload.entity || this.entity
      // if this entity is cached
      if (this.isCached) {
        // get cache on redis
        // let redisData = await this.application.getRedisKey(_setCacheKeyName(this.isCachedBasedOnUser, job, where, options))

        const redisData = await this.application.getRedisHkey(
          collection,
          _setCacheKeyName(this.isCachedBasedOnUser, job, where, options)
        )
        if (redisData) {
          // if cache exists
          if (redisData.data !== null) {
            // parse cached string as JSON
            data = JSON.parse(redisData.data)
          } else {
            // get data from Mongo
            data = await this.application.$models.mongoose[collection].paginate(
              where,
              options
            )
            // save cache
            // this.application.redis.store.setex(_setCacheKeyName(this.isCachedBasedOnUser, job, where, options), this.cacheExpiresIn, JSON.stringify(data))

            this.application.redis.store.hset(
              collection,
              _setCacheKeyName(this.isCachedBasedOnUser, job, where, options),
              JSON.stringify(data)
            )
            this.application.redis.store.expire(collection, this.cacheExpiresIn)
          }
        } else {
          // get data from Mongo
          data = await this.application.$models.mongoose[collection].paginate(
            where,
            options
          )
          // save cache
          // this.application.redis.store.setex(_setCacheKeyName(this.isCachedBasedOnUser, job, where, options), this.cacheExpiresIn, JSON.stringify(data))

          this.application.redis.store.hset(
            collection,
            _setCacheKeyName(this.isCachedBasedOnUser, job, where, options),
            JSON.stringify(data)
          )
          this.application.redis.store.expire(collection, this.cacheExpiresIn)
        }
      }
      // if this entity is not cached
      else {
        // get data from Mongo
        data = await this.application.$models.mongoose[collection].paginate(
          where,
          options
        )
      }

      return data
    }

    async _addSubDocumentMongo (job) {
      job.payload = job.payload || {}
      const self = this

      // using promisse instead async and await due a concurrency issue when calling model.save()
      const payload = job.payload
      const primaryKeyValue = payload[self.primaryKeyName]
      const userId = job.from.human._id
      const str = null
      const obj = null
      let error = false
      let record = false
      let data = false

      if (!job.payload[self.primaryKeyName]) {
        return {
          error: `Payload must have an ${self.primaryKeyName} to call findById`,
          status: 400
        }
      }
      if (!isDefined(job.from.human._id)) {
        return {
          error: 'job.from.human._id must be provided',
          status: 400
        }
      }

      try {
        record = await self.application.$models.mongoose[self.entity].findById(
          primaryKeyValue
        )
        if (typeof record === 'undefined') {
          return {
            error: `Record not found on Mongo  ${primaryKeyValue} ${self.entity} collection`,
            status: 404
          }
        }
        if (record === null) {
          return {
            error: `Record not found on Mongo ${primaryKeyValue} ${self.entity} collection`,
            status: 404
          }
        }
        if (record.deleted) {
          return {
            error: 'Record is deleted and can not be updated',
            status: 404
          }
        }
        record.updatedAt = new Date(Date.now()).toString()
        if (userId !== '0' && userId !== 0) {
          record.updatedBy = userId
        }
        // console.log('payload', payload)
        let alreadyExist = false
        record[payload.subCollectionName].forEach((doc) => {
          if (doc._id === payload.document._id) {
            alreadyExist = true
          }
        })
        if (alreadyExist) {
          return {
            error: 'A sub document with that _id alread exist',
            status: 400
          }
        }
        payload.document.createdBy = userId
        record[payload.subCollectionName].push(payload.document)

        data = await record.save()
        self.application.clearKey(self.entity)
      } catch (err) {
        console.log(err.message, error)
        error = err.message || err
        if (err.code === 11000) {
          error = err
        }
        // await session.abortTransaction()
        // session.endSession()
      }
      // console.log('job', job)

      return {
        error,
        data,
        status: error ? 500 : 201
      }
    }

    async _editSubDocumentMongo (job) {
      job.payload = job.payload || {}
      const self = this

      // using promisse instead async and await due a concurrency issue when calling model.save()
      const payload = job.payload
      const primaryKeyValue = payload[self.primaryKeyName]
      const userId = job.from.human._id
      const str = null
      const obj = null
      let error = false
      let record = false
      let data = false

      if (!job.payload[self.primaryKeyName]) {
        return {
          error: `Payload must have an ${self.primaryKeyName} to call findById`,
          status: 400
        }
      }
      if (!isDefined(job.from.human._id)) {
        return {
          error: 'job.from.human._id must be provided',
          status: 400
        }
      }

      try {
        record = await self.application.$models.mongoose[self.entity].findById(
          primaryKeyValue
        )
        if (typeof record === 'undefined') {
          return {
            error: `Record not found on Mongo  ${primaryKeyValue} ${self.entity} collection`,
            status: 404
          }
        }
        if (record === null) {
          return {
            error: `Record not found on Mongo ${primaryKeyValue} ${self.entity} collection`,
            status: 404
          }
        }
        if (record.deleted) {
          return {
            error: 'Record is deleted and can not be updated',
            status: 404
          }
        }
        record.updatedAt = new Date(Date.now()).toString()
        if (userId !== '0' && userId !== 0) {
          record.updatedBy = userId
        }
        // console.log('payload', payload)

        let alreadyExist = false

        // console.log('doc to find', payload.document._id)
        record[payload.subCollectionName].forEach((doc, index) => {
          // console.log('doc._id', doc._id)
          // console.log(doc._id.toString() === payload.document._id.toString())
          if (doc._id.toString() === payload.document._id.toString()) {
            alreadyExist = true
            payload.document.updatedBy = userId
            payload.document.updatedAt = new Date(Date.now()).toString()
            record[payload.subCollectionName].splice(index, 1, payload.document)
          }
        })
        if (!alreadyExist) {
          return {
            error: 'Sub document not found',
            status: 404
          }
        }

        data = await record.save()
        self.application.clearKey(self.entity)
      } catch (err) {
        console.log(err.message, error)
        error = err.message || err
        if (err.code === 11000) {
          error = err
        }
        // await session.abortTransaction()
        // session.endSession()
      }
      // console.log('job', job)

      return {
        error,
        data,
        status: error ? 500 : 201
      }
    }

    async _deleteSubDocumentMongo (job) {
      job.payload = job.payload || {}
      const self = this

      // using promisse instead async and await due a concurrency issue when calling model.save()
      const payload = job.payload
      const primaryKeyValue = payload[self.primaryKeyName]
      const userId = job.from.human._id
      const str = null
      const obj = null
      let error = false
      let record = false
      let data = false

      if (!job.payload[self.primaryKeyName]) {
        return {
          error: `Payload must have an ${self.primaryKeyName} to call findById`,
          status: 400
        }
      }
      if (!isDefined(job.from.human._id)) {
        return {
          error: 'job.from.human._id must be provided',
          status: 400
        }
      }

      try {
        record = await self.application.$models.mongoose[self.entity].findById(
          primaryKeyValue
        )
        if (typeof record === 'undefined') {
          return {
            error: `Record not found on Mongo  ${primaryKeyValue} ${self.entity} collection`,
            status: 404
          }
        }
        if (record === null) {
          return {
            error: `Record not found on Mongo ${primaryKeyValue} ${self.entity} collection`,
            status: 404
          }
        }
        if (record.deleted) {
          return {
            error: 'Record is deleted and can not be updated',
            status: 404
          }
        }
        record.updatedAt = new Date(Date.now()).toString()
        if (userId !== '0' && userId !== 0) {
          record.updatedBy = userId
        }
        // console.log('payload', payload)

        const alreadyExist = false

        record[payload.subCollectionName].pull(payload.document._id)

        data = await record.save()
        self.application.clearKey(self.entity)
      } catch (err) {
        console.log(err.message, error)
        error = err.message || err
        if (err.code === 11000) {
          error = err
        }
        // await session.abortTransaction()
        // session.endSession()
      }
      // console.log('job', job)

      return {
        error,
        data,
        status: error ? 500 : 201
      }
    }
  }

export default MongooseAPI
