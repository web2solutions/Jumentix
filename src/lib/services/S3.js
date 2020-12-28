'use strict'

import Service from '../Job/Service'
import AWS from 'aws-sdk'

/**
 * Class representing a S3 Service
 * @extends Service
 */
class S3 extends Service {
  /**
   * Creates a S3 Service
   * @constructor
   * @param {object} application - the application object which this service is plugged to
   */
  constructor(application) {
    /** call super is mandatory and shall to be called first. */
    super(application) // mandatory to call

    this.entity = 'S3'

    this.aws = AWS
    // Setting aws configuration
    this.aws.config.update(this.application.config.aws.config)

    // initializing AWS S3
    this.s3 = new this.aws.S3()
  }

  /**
   * Delete multiple s3 objects using s3 deleteObjects method
   * @function
   * @param {object} job - mandatory - a job object representing the job information to create a Entity
   * @param {buffer} msg - a buffer representing the rabbitmq message
   * @return {object} { error, data, status }
   */
  async deleteObjects(job, msg = false) {
    /**
            Validate job payload
            mandatory run this PRIOR trying to execute any job
        */
    if (!this.isValidJob(job, msg)) {
      return { error: `Invalid task` }
    }

    let self = this,
      data = null,
      error = null,
      status = null,
      payload = job.payload

    try {
      const s3BucketName =
          payload.bucketName || self.application.config.aws.s3.bucketName,
        options = {
          Bucket: s3BucketName,
          Delete: {
            Objects: payload.objects,
            Quiet: false
          }
        }
      data = await self.s3.deleteObjects(options).promise()
      this.jobDone(job, data, msg)
    } catch (e) {
      error = e
      this.jobNotDone(
        job,
        msg,
        `error delete s3 objects ${this.entity} - ${error}`
      )
    }
    return { error, data, status }
  }
}

export default S3
