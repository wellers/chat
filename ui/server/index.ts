import http from "http";
import express from "express";
import path from "path";
import ws, { OPEN } from "ws";
import amqplib from "amqplib";
import JSONStream from "JSONStream";
import axios from "axios";

const {
	HISTORY_URL,
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
	const connection = await amqplib.connect({
		protocol: "amqp",
		hostname: CLOUDAMQP_HOST,
		port: CLOUDAMQP_PORT as number | undefined,
		username: RABBITMQ_USERNAME,
		password: RABBITMQ_PASSWORD,
		vhost: RABBITMQ_VHOST
	}, "heartbeat=60");

	const channel = await connection.createChannel();
	await channel.assertExchange(RABBITMQ_EXCHANGE_NAME!, "fanout");
	const { queue } = await channel.assertQueue(RABBITMQ_QUEUE_NAME!, { exclusive: true });
	await channel.bindQueue(queue, RABBITMQ_EXCHANGE_NAME!, RABBITMQ_ROUTE_NAME!);

	channel.consume(queue, message => {
		if (!message) {
			console.error("Cannot record an empty message.");
			return;
		}

		console.log(`From queue: ${message?.content.toString()}`);
		broadcast(message?.content.toString());
	}, { noAck: true });

	// express to host web front-end
	const app = express();

	app.use(express.static(path.join(__dirname, "..", "public")));

	app.get("/", (req, res) => {
		res.sendFile(path.join(__dirname, "..", "public/index.html"));
	});

	const server = http.createServer(app);

	// websocket server to handle sending and receiving messages
	const wss = new ws.Server({ server });

	wss.on("connection", async client => {
		console.log("Client connected.");

		client.on("message", message => {
			console.log(`Message: ${message}`);
			channel.publish(RABBITMQ_EXCHANGE_NAME as string, "", Buffer.from(message.toString()));
		});

		// query the history service and stream responses
		const response = await axios.get(HISTORY_URL!, {
			responseType: "stream"
		});
		
		const stream = response.data.pipe(JSONStream.parse("*"));
		
		stream.on("data", msg => {
			console.log("message:", msg);
			client.send(msg);
		});
		
		stream.on("error", err => console.error(err));
	});

	function broadcast(message) {
		for (const client of wss.clients) {
			if (client.readyState === OPEN) {
				client.send(message);
			}
		}
	}

	server.listen(80);
}

boot().catch(err => console.error(err));
