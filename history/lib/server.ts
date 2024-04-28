import { createServer } from "http";
import { Level } from "level";
import timestamp from "monotonic-timestamp";
import amqp from "amqplib";
import { Readable } from "stream";
import JSONStream from "JSONStream";

const {
	CLOUDAMQP_HOST,
	CLOUDAMQP_PORT,
	RABBITMQ_USERNAME,
	RABBITMQ_PASSWORD,
	RABBITMQ_VHOST,
	RABBITMQ_QUEUE_NAME,
	RABBITMQ_EXCHANGE_NAME,
	RABBITMQ_ROUTE_NAME
} = process.env;

async function boot() {
	const db = new Level("./msgHistory");

	const connection = await amqp.connect({
		protocol: "amqp",
		hostname: CLOUDAMQP_HOST,
		port: CLOUDAMQP_PORT as number | undefined,
		username: RABBITMQ_USERNAME,
		password: RABBITMQ_PASSWORD,
		vhost: RABBITMQ_VHOST
	}, "heartbeat=60");

	const channel = await connection.createChannel();
	await channel.assertExchange(RABBITMQ_EXCHANGE_NAME as string, "fanout");
	const { queue } = await channel.assertQueue(RABBITMQ_QUEUE_NAME as string);
	await channel.bindQueue(queue, RABBITMQ_EXCHANGE_NAME as string, RABBITMQ_ROUTE_NAME as string);

	channel.consume(queue, async message => {
		if (!message) {
			console.error("Cannot record an empty message.");
			return;
		}

		const content = message?.content.toString();

		console.log(`Saving message: ${content}`);

		await db.put(timestamp(), content);

		channel.ack(message);
	});

	const server = createServer(async (req, res) => {
		res.writeHead(200);

		const values = await db.values().all();

		Readable.from(values)
			.pipe(JSONStream.stringify())
			.pipe(res);
	});

	server.listen(80);
}

boot().catch(err => console.error(err));