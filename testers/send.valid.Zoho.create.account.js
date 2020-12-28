let id = (new Date()).getTime()
const __CAIRS_USER__ = {
    "userId" : `${id}`,
    "companyId" : 1,
    "user_email" : "web2solucoes@gmail.com",
    "name": "Jose Eduardo",
    id: `${id}`,
}

let amqp = require('amqplib/callback_api'),
    // add rabbitmq module to worker scope
    composer = require('../dist/lib/composer').default,
    env = process.env.NODE_ENV || "development",
    mqConfig = require('../dist/config/mq.js').default[env],
    queueName = mqConfig.queue,
    // the rabbitMQ connection string
    connString = mqConfig.rabbitUser + ":" + mqConfig.rabbitPassword + "@" + mqConfig.rabbitServer + ":" + mqConfig.rabbitPort + "/?heartbeat=" + mqConfig.rabbitHeartBeat;

//console.log( composer )

let job_task = new composer.message(
{
    "from": __CAIRS_USER__,
    "entity" : "Zoho",
    "action" : "accountCreate",
    "payload" :
    {
        account_id: '5ddc2a428adc303477b66674', // Mongo account id
        "data": {
                "Account_Name": "fake data",
                "Agency_Contact": "fake data",
                "CAIRS_Products_Used": ["ParentFinder"],
                "Billing_State": "fake data",
                "Billing_Street": "fake data",
                "Description": "fake data",
                "ZipCode": "3333",
                "Billing_City": "NY",
                "Website": "",
                "Phone": "33333"
            }
    }
})

amqp.connect("amqp://" + connString, (err, conn) =>
{
    conn.createChannel( (err, ch) =>
    {
        let msg = JSON.stringify(job_task);
        console.log(queueName);
        ch.assertQueue(queueName,
        {
            durable : true
        });
        // Note: on Node 6 Buffer.from(msg) should be used
        ch.sendToQueue(queueName, new Buffer(msg));
        console.log(" [x] Sent Message in to Worker to ####  %s", msg);
        setTimeout( () =>
        {
            conn.close();
            process.exit(1);
        }, 1000);
    });
});
