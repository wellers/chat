import http from "http";
import express from "express";
import path from "path";
import { Server, OPEN } from "ws";
import amqplib from "amqplib";
import JSONStream from "JSONStream";
import superagent from "superagent";

const { QUEUE_NAME } = process.env;
const hostname = "192.168.50.101";
const username = "test_user";
const password = "password";
const vhost = "/test_host";
const queue_name = QUEUE_NAME as string;
const exchange_name = "chat";
const route_name = "test_route";

async function main() {
	const connection = await amqplib.connect({
		protocol: "amqp",
		hostname,
		port: 5672,
		username,
		password,
		vhost
	}, "heartbeat=60");

	const channel = await connection.createChannel();
	await channel.assertExchange(exchange_name, "fanout");
	const { queue } = await channel.assertQueue(queue_name, { exclusive: true });
	await channel.bindQueue(queue, exchange_name, route_name);

	channel.consume(queue, message => {
		if (!message) {
			console.error("Cannot record an empty message.");
			return;
		}

		console.log(`From queue: ${message?.content.toString()}`);
		broadcast(message?.content.toString());
	}, { noAck: true });

	const app = express();

	app.use(express.static(path.join(__dirname, "..", "public")));

	app.get("/", (req, res) => {
		res.sendFile(path.join(__dirname, "..", "public/index.html"));
	});

	const server = http.createServer(app);

	const wss = new Server({ server });

	wss.on("connection", client => {
		console.log("Client connected.");

		client.on("message", message => {
			console.log(`Message: ${message}`);
			channel.publish("chat", "", Buffer.from(message.toString()));
		});

		// query the history service
		superagent
			.get(`http://${hostname}:8089/`)
			.on("error", err => console.error(err))
			.pipe(JSONStream.parse("*"))
			.on("data", msg => {
				console.log("message:", msg);
				client.send(msg);
			});
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

main().catch(err => console.error(err));