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
    "entity" : "Wordpress",
    "action" : "userUpdate",
    "payload" :
    {
      mapping_id: "59",
      first_name: 'Mark',
      last_name: 'Livings',
      email: 'marklivings@me.com'
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