let id = (new Date()).getTime()
const __CAIRS_USER__ = {
    "userId": `5e4fc5a661a78c0cf7e999b3`,
    "companyId": 1,
    "user_email": "web2solucoes@gmail.com",
    "name": "Jose Eduardo",
    id: `5e4fc5a661a78c0cf7e999b3`,
    active: true
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
        "entity": "BadgeActivity",
        "action": "create",
        "payload":
        {
            account: "5e4fc5a661a78c0cf7e999b5",
            agency: "5e4fc5a661a78c0cf7e999b4",
            action: "View",
            resource: "Profile",
            consumer: {
                name: "Test Usr"
            }
        }
    })

amqp.connect("amqp://" + connString, (err, conn) => {
    conn.createChannel((err, ch) => {
        let msg = JSON.stringify(job_task);
        console.log(queueName);
        ch.assertQueue(queueName,
            {
                durable: true
            });
        // Note: on Node 6 Buffer.from(msg) should be used
        ch.sendToQueue(queueName, new Buffer(msg));
        console.log(" [x] Sent Message in to Worker to ####  %s", msg);
        setTimeout(() => {
            conn.close();
            process.exit(1);
        }, 1000);
    });
});
