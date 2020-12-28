/* global describe, it */

import http from 'http';
import assert from 'assert';
import request from 'request';
import config from '../src/config';
import _mqConfig from '../src/config/mq';
import amqp from 'amqplib/callback_api';
import
{
    isDefined,
    isArray,
    isNumber
}
from '../src/lib/util'


const env = process.env.NODE_ENV || "development",
    conf = config[env],
    host = `http://${conf.server.ip}:${conf.server.port}`,
    mqConfig = _mqConfig[env],
    // ====>
    kindUser = `CaseWorker Manager`,
    entity = `CaseStatus`,
    haveWritePermission = true,
    isSuperUser = false,
    username = `caseworker.manager@caseworkermanager.com`,
    // ====> ^^
    password = `3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1eb8b85103e3be7ba613b31bb5c9c36214dc9f14a42fd7a2fdb84856bca5c44c2`;

let token = ``,
    permCreateStatus = 201, // 201, 403
    permUpdateStatus = 200, // 200, 403
    permHardDeleteStatus = 200, // 200, 403
    permRestoreStatus = 200, // 200, 403
    permCreateLabel = `Created`, // Forbidden
    permUpdateLabel = `Updated`, // Forbidden
    permHardDeleteLabel = `Deleted`, // Forbidden
    permRestoreLabel = `Restored`, // Forbidden
    // ====>
    entityPayload = {
        "status" : "Submitted" + ( new Date() ).getTime(),
        "label" : "Submitted" + ( new Date() ).getTime()
    };
    // ====>


    if(!haveWritePermission)
    {
        permCreateStatus = 403; // 201, 403
        permUpdateStatus = 403; // 200, 403
        permHardDeleteStatus = 403; // 200, 403
        permRestoreStatus = 403; // 200, 403

        permCreateLabel = `Forbidden`; // Forbidden
        permUpdateLabel = `Forbidden`; // Forbidden
        permHardDeleteLabel = `Forbidden`; // Forbidden
        permRestoreLabel = `Forbidden`; // Forbidden
    }


describe(`#--- ${entity} Test Suite - ${kindUser}`, () =>
{
    // admin
    describe(`Testing as ${kindUser} user`, () =>
    {
        describe(`Login as ${kindUser} testing`, () =>
        {
            it(`/auth/local should return 200 (Login Success)`, done =>
            {
                let options = {
                    method : `POST`,
                    url : `${host}/auth/local`,
                    json :
                    {
                        username : `${username}`,
                        password : `${password}`
                    }
                };
                request(options, function(error, res, body)
                {
                    //console.log( body )
                    if (error)
                        throw new Error(error);
                    token = body.token;

                    assert.equal(200, res.statusCode);
                    done();
                });

            });
        });


        describe(`Database CRUD testing as ${kindUser}`, () =>
        {
            let 
                newDocument = false;

            it(`List ${entity} -> GET /api/${entity} should return 200 (ok)`, done =>
            {
                let options = {
                    method : `GET`,
                    url : `${host}/api/${entity}`,
                    headers :
                    {
                        "authorization" : `Bearer ${token}`
                    }
                };
                request(options, function(error, res, b)
                {
                    if (error)
                        throw new Error(error);
                    let body = JSON.parse(b)
                    assert.equal(200, res.statusCode);
                    assert.equal(true, isArray(body.data));
                    assert.equal(true, isNumber(body.count));
                    assert.equal(true, isNumber(body.pages));
                    assert.equal(true, isNumber(body.page));
                    done();
                });
            });

            it(`Read ${entity} with fake ID -> GET /api/${entity}/:id should return 404 (Not found)`, done =>
            {
                let options = {
                    method : `GET`,
                    url : `${host}/api/${entity}/5c585ab5bfbfa98b7b966bd1`,
                    headers :
                    {
                        "authorization" : `Bearer ${token}`
                    }
                };
                request(options, function(error, res, b)
                {
                    if (error)
                        throw new Error(error);
                    let body = JSON.parse(b)
                    assert.equal(res.statusCode, 404);
                    done();
                });
            });


            it(`Create ${entity} -> POST /api/${entity} should return ${permCreateStatus} ${permCreateLabel}`, done =>
            {
                let options = {
                    method : `POST`,
                    url : `${host}/api/${entity}`,
                    headers :
                    {
                        "authorization" : `Bearer ${token}`
                    },
                    json : entityPayload
                };
                request(options, function(error, res, b)
                {
                    if (error)
                        throw new Error(error);

                    let body = b

                    assert.equal(permCreateStatus, res.statusCode);

                    if(haveWritePermission) 
                    {
                        assert.equal(entityPayload.status, body.data.status)
                        newDocument = body.data
                    }
                    done();

                });
            });


            if(haveWritePermission) 
            {

                describe(`Write permission testing`, () =>
                {
                    it(`Read created ${entity} -> GET /api/${entity}/:id should return 200 (Ok)`, done =>
                    {
                        let options = {
                            method : `GET`,
                            url : `${host}/api/${entity}/${newDocument._id}`,
                            headers :
                            {
                                "authorization" : `Bearer ${token}`
                            }
                        };
                        request(options, function(error, res, b)
                        {
                            if (error)
                                throw new Error(error);
                            let body = JSON.parse(b)

                            assert.equal(200, res.statusCode);
                            assert.equal(entityPayload.status, body.data.status);
                            done();
                        });
                    });

                    it(`Update ${entity} -> PUT /api/${entity}/:id should return ${permUpdateStatus} (${permUpdateLabel})`, done =>
                    {
                        entityPayload.status = 'Approved' + ( new Date() ).getTime()
                        let options = {
                            method : `PUT`,
                            url : `${host}/api/${entity}/${newDocument._id}`,
                            headers :
                            {
                                "authorization" : `Bearer ${token}`
                            },
                            json : entityPayload
                        };
                        request(options, function(error, res, body)
                        {
                            if (error)
                                throw new Error(error);
                            assert.equal(200, res.statusCode);
                            assert.equal(entityPayload.status, body.data.status);
                            done();
                        });

                    });


                    describe(`Check CREATE validation - required properties missing`, () =>
                    {
                        let mandatory = ["status"]
                        mandatory.forEach(property =>
                        {
                            it(`Create ${entity} - ${property}  missing -> POST /api/${entity} should return 400 (Bad Request) `, done =>
                            {
                                let g = JSON.parse(JSON.stringify(entityPayload))
                                delete g[property]
                                let options = {
                                    method : `POST`,
                                    url : `${host}/api/${entity}`,
                                    headers :
                                    {
                                        "authorization" : `Bearer ${token}`
                                    },
                                    json : g
                                };
                                request(options, function(error, res, b)
                                {
                                    if (error)
                                        throw new Error(error);

                                    let body = b
                                    assert.equal(400, res.statusCode);
                                    done();

                                });
                            });
                        })

                    });


                    describe(`Check CREATE validation - properties data type`, () =>
                    {

                        let bad = {
                            "status" : 333
                        }

                        for (let property in bad)
                        {
                            it(`Create ${entity} - ${property}  - ${bad[ property ]} as ${typeof bad[ property ]} (invalid type) -> POST /api/${entity} should return 400 (Bad Request) `, done =>
                            {
                                let g = JSON.parse(JSON.stringify(entityPayload))
                                //delete g[ property ]
                                g[property] = bad[property]

                                let options = {
                                    method : `POST`,
                                    url : `${host}/api/${entity}`,
                                    headers :
                                    {
                                        "authorization" : `Bearer ${token}`
                                    },
                                    json : g
                                };
                                request(options, function(error, res, b)
                                {
                                    if (error)
                                        throw new Error(error);

                                    let body = b
                                    assert.equal(400, res.statusCode);
                                    done();

                                });
                            });

                        }

                    });



                    describe(`Check UPDTE validation - properties data type`, () =>
                    {

                        let bad = {
                            "status" : 333
                        }

                        for (let property in bad)
                        {
                            it(`Update ${entity} - ${property}  - ${bad[ property ]} as ${typeof bad[ property ]} (invalid type) -> PUT /api/${entity}/:id should return 400 (Bad Request) `, done =>
                            {
                                let g = JSON.parse(JSON.stringify(entityPayload))
                                //delete g[ property ]
                                g[property] = bad[property]

                                let options = {
                                    method : `PUT`,
                                    url : `${host}/api/${entity}/${newDocument._id}`,
                                    headers :
                                    {
                                        "authorization" : `Bearer ${token}`
                                    },
                                    json : g
                                };
                                request(options, function(error, res, b)
                                {
                                    if (error)
                                        throw new Error(error);

                                    let body = b
                                    assert.equal(400, res.statusCode);
                                    done();

                                });
                            });

                        }

                    });

                    it(`Delete ${entity} -> DEL /api/${entity}/:id should return 200 (Deleted)`, done =>
                    {
                        let options = {
                            method : `DELETE`,
                            url : `${host}/api/${entity}/${newDocument._id}`,
                            headers :
                            {
                                "authorization" : `Bearer ${token}`
                            }
                        };
                        request(options, function(error, res, b)
                        {
                            if (error)
                                throw new Error(error);
                            let body = JSON.parse(b)

                            assert.equal(200, res.statusCode);
                            assert.equal(true, body.data.deleted);
                            done();
                        });

                    });


                    it(`Update Deleted ${entity} -> PUT /api/${entity}/:id should return 404 (Not found)`, done =>
                    {
                        entityPayload.status = 'In Progress'
                        let options = {
                            method : `PUT`,
                            url : `${host}/api/${entity}/${newDocument._id}`,
                            headers :
                            {
                                "authorization" : `Bearer ${token}`
                            },
                            json : entityPayload
                        };
                        request(options, function(error, res, body)
                        {
                            if (error)
                                throw new Error(error);
                            assert.equal(404, res.statusCode);
                            done();
                        });
                    });

                    

                });


                
            }

            if(isSuperUser) 
            {
                describe(`SuperUser testing`, () =>
                {
                    it(`Restore Soft Deleted ${entity} -> PATCH /api/${entity}/:id should return 200 (Restored)`, done =>
                    {
                        let options = {
                            method : `PATCH`,
                            url : `${host}/api/${entity}/${newDocument._id}`,
                            headers :
                            {
                                "authorization" : `Bearer ${token}`
                            }
                        };
                        request(options, function(error, res, b)
                        {
                            if (error)
                                throw new Error(error);
                            let body = JSON.parse(b)

                            assert.equal(200, res.statusCode);
                            done();
                        });

                    });

                    it(`Hard Delete ${entity} -> DEL /api/${entity}/:id should return 200 (Deleted)`, done =>
                    {
                        let options = {
                            method : `DELETE`,
                            url : `${host}/api/${entity}/${newDocument._id}?mode=hard`,
                            headers :
                            {
                                "authorization" : `Bearer ${token}`
                            }
                        };
                        request(options, function(error, res, b)
                        {
                            if (error)
                                throw new Error(error);
                            let body = JSON.parse(b)

                            assert.equal(200, res.statusCode);
                            // assert.equal(true, body.data.deleted);
                            done();
                        });

                    });
                });
                
            }
            else
            {
                describe(`Non SuperUser testing`, () =>
                {
                    it(`Restore Soft Deleted ${entity} -> PATCH /api/${entity}/:id should return 403 (Forbidden)`, done =>
                    {
                        let options = {
                            method : `PATCH`,
                            url : `${host}/api/${entity}/${newDocument._id}`,
                            headers :
                            {
                                "authorization" : `Bearer ${token}`
                            }
                        };
                        request(options, function(error, res, b)
                        {
                            if (error)
                                throw new Error(error);
                            let body = JSON.parse(b)

                            assert.equal(403, res.statusCode);
                            done();
                        });

                    });

                    it(`Hard Delete ${entity} -> DEL /api/${entity}/:id should return 403 (Forbidden`, done =>
                    {
                        let options = {
                            method : `DELETE`,
                            url : `${host}/api/${entity}/${newDocument._id}?mode=hard`,
                            headers :
                            {
                                "authorization" : `Bearer ${token}`
                            }
                        };
                        request(options, function(error, res, b)
                        {
                            if (error)
                                throw new Error(error);
                            let body = JSON.parse(b)

                            assert.equal(403, res.statusCode);
                            // assert.equal(true, body.data.deleted);
                            done();
                        });

                    });
                });
            }

        });
        describe(`${kindUser} Logout testing`, () =>
        {
            it(`/auth/logout should return 200 (Logout)`, done =>
            {
                let options = {
                    method : `DELETE`,
                    url : `${host}/auth/logout`,
                    headers :
                    {
                        "authorization" : `Bearer ${token}`
                    }
                };
                request(options, function(error, res, body)
                {
                    if (error)
                        throw new Error(error);
                    assert.equal(200, res.statusCode);
                    done();

                });
            });
        });
    });
    // end ${kindUser}
});
