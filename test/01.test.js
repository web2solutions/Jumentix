/* global describe, it */

import http from 'http'
import assert from 'assert'
import request from 'request'
import config from '../src/config'
// import _mqConfig from '../src/config/mq'
// import amqp from 'amqplib/callback_api'
// import { isDefined, isArray, isNumber } from '../src/lib/util'
import { sha512 } from 'js-sha512'

const env = process.env.NODE_ENV || 'development'
const conf = config[env]
const host = `http://${conf.server.ip}:${conf.server.port}`

let token = ''

// console.log( 'host', host  )

describe('#--- Main Test Suite', () => {
  describe('Check if API is online', () => {
    // Server Online
    it('Getting API root address should return 404 (Not Found) (No defined End Point)', done => {
      http.get(host, res => {
        // console.log(res)
        assert.equal(404, res.statusCode)
        done()
      })
    })
  })

  describe('Setup testing', () => {
    it('/application/setup should return 200 (Ok)', done => {
      http.get(`${host}/application/setup`, res => {
        // console.log('Setup response')
        // console.log(res)
        assert.equal(200, res.statusCode)
        done()
      })
    })
  })

  describe('Admin Main testing', () => {
    describe('Auth testing', () => {
      it('/auth/local should return 200 (Login Success)', done => {
        const options = {
          method: 'POST',
          url: `${host}/auth/local`,
          json: {
            username: 'admin@admin.com',
            password: sha512.hex('123456')
          }
        }
        request(options, function (error, res, body) {
          // console.log( body )
          if (error) { throw new Error(error) }
          token = body.token

          assert.equal(200, res.statusCode)
          done()
        })
      })

      // Test Middleware
      it('/api/user/me without token should return 401 (Unauthorized)', done => {
        const options = {
          method: 'GET',
          url: `${host}/api/user/me`
        }
        request(options, function (error, res, b) {
          // console.log(b)
          if (error) { throw new Error(error) }
          // const body = JSON.parse(b)
          // console.log(body)
          assert.equal(401, res.statusCode)
          done()
        })
      })
    })

    describe('Session testing', () => {
      it('/api/user/me with token should return 200 (Ok)', done => {
        const options = {
          method: 'GET',
          url: `${host}/api/user/me`,
          headers: {
            authorization: `Bearer ${token}`
          }
        }
        request(options, function (error, res, b) {
          // console.log(b)
          if (error) { throw new Error(error) }
          // const body = JSON.parse(b)
          assert.equal(200, res.statusCode)
          // assert.equal( true, isNumber( body.count ) );
          // assert.equal( true, isNumber( body.pages ) );
          // assert.equal( true, isNumber( body.page ) );
          done()
        })
      })

      it('/api/user/me first_name must be Admin', done => {
        const options = {
          method: 'GET',
          url: `${host}/api/user/me`,
          headers: {
            authorization: `Bearer ${token}`
          }
        }
        request(options, function (error, res, b) {
          if (error) { throw new Error(error) }
          const body = JSON.parse(b)
          assert.equal('Admin', body.data.human.first_name)
          done()
        })
      })
    })

    describe('Logout testing', () => {
      it('/api/auth/logout should return 200 (Logout)', done => {
        const options = {
          method: 'DELETE',
          url: `${host}/api/auth/logout`,
          headers: {
            authorization: `Bearer ${token}`
          }
        }
        request(options, function (error, res, body) {
          // console.log(body)
          if (error) { throw new Error(error) }
          assert.equal(200, res.statusCode)
          done()
        })
      })
    })
  })

  /* describe('User Main testing', () =>
    {
        describe('Auth testing', () =>
        {

            it('/auth/local should return 200 (Login Success)', done =>
            {
                let options = {
                        method: 'POST',
                        url: `${host}/auth/local`,
                        json: {
                            username: 'staff@staff.com',
                            password: '3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1eb8b85103e3be7ba613b31bb5c9c36214dc9f14a42fd7a2fdb84856bca5c44c2'
                        }
                    };
                request(options, function(error, res, body) {
                    //console.log( body )
                    if (error)
                        throw new Error(error);
                    token = body.token;

                    assert.equal(200, res.statusCode);
                    done();
                });

            });

            // Test Middleware
            it('/api/user/me without token should return 401 (Unauthorized)', done =>
            {
                http.get(`${host}/api/user/me`, res => {
                    //console.log( res.statusCode )
                    //console.log( res )
                    assert.equal(401, res.statusCode);
                    done();
                });
            });
        });

        describe('Session testing', () =>
        {

            it('/api/user/me with token should return 200 (Ok)', done =>
            {
                let options = {
                    method: 'GET',
                    url: `${host}/api/user/me`,
                    headers: {
                        'authorization': `Bearer ${token}`
                    }
                };
                request(options, function(error, res, b) {
                    if (error)
                        throw new Error(error);
                    let body = JSON.parse( b )
                    assert.equal( 200, res.statusCode );
                    //assert.equal( true, isNumber( body.count ) );
                    //assert.equal( true, isNumber( body.pages ) );
                    //assert.equal( true, isNumber( body.page ) );
                    done();
                });
            });

            it('/api/user/me first_name must be Staff', done =>
            {
                let options = {
                    method: 'GET',
                    url: `${host}/api/user/me`,
                    headers: {
                        'authorization': `Bearer ${token}`
                    }
                };
                request(options, function(error, res, b) {
                    if (error)
                        throw new Error(error);
                    let body = JSON.parse( b )
                    assert.equal( "Staff", body.data.human.first_name );
                    done();
                });
            });
        });

        describe('Logout testing', () =>
        {
            it('/auth/logout should return 200 (Logout)', done =>
            {
                let options = {
                    method: 'DELETE',
                    url: `${host}/auth/logout`,
                    headers: {
                        'authorization': `Bearer ${token}`
                    }
                };
                request(options, function(error, res, body) {
                    //console.log(body)
                    if (error)
                        throw new Error(error);
                    assert.equal(200, res.statusCode);
                    done();

                });
            });
        });
    }); */
})
