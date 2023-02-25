import { createServer } from "http";
import { Level } from "level";
import timestamp from "monotonic-timestamp";
import amqp from "amqplib";
import { Readable } from "stream";
import JSONStream from "JSONStream";

const hostname = "192.168.50.101";
const username = "test_user";
const password = "password";
const vhost = "/test_host";
const queue_name = "chat_history";
const exchange_name = "chat";
const route_name = "test_route";

async function main() {
	const db = new Level("./msgHistory");

	const connection = await amqp.connect({
		protocol: "amqp",
		hostname,
		port: 5672,
		username,
		password,
		vhost
	}, "heartbeat=60");

	const channel = await connection.createChannel();
	await channel.assertExchange(exchange_name, "fanout");
	const { queue } = await channel.assertQueue(queue_name);
	await channel.bindQueue(queue, exchange_name, route_name);

	channel.consume(queue, async message => {
		if (!message) {
			console.error("Cannot record an empty message.");
			return;
		}

		const content = message?.content.toString();

		console.log(`Saving message: ${content}`);

		await db.put(timestamp(), content);

		channel.ack(message);
	})

	const server = createServer(async (req, res) => {
		res.writeHead(200);

		const values = await db.values().all();

		Readable.from(values)
			.pipe(JSONStream.stringify())
			.pipe(res);
	});

	server.listen(80);
}

main().catch(err => console.error(err));