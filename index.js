const express = require("express");
const fetch = require("node-fetch");
const ngrok = require("ngrok");

const app = express();
app.use(express.json());

// ==== CONFIG ====
// Use env vars if set, otherwise fallback to hardcoded
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";     // ← replace
const CHANNEL_ID = process.env.CHANNEL_ID || "YOUR_CHANNEL_ID_HERE"; // ← replace

if (!BOT_TOKEN || !CHANNEL_ID) {
	console.error("❌ BOT_TOKEN or CHANNEL_ID is missing.");
	process.exit(1);
}

// Random port between 1000 and 4000
const PORT = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000;

// ==== ROUTES ====
app.get("/", (_, res) => res.send("🤖 Discord Bot Proxy is running."));

app.post("/send", async (req, res) => {
	try {
		// 1. Fetch last message
		const messages = await fetch(
			`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=1`,
			{ headers: { Authorization: `Bot ${BOT_TOKEN}` } }
		).then(r => r.json());

		// 2. Delete last message if it exists
		if (Array.isArray(messages) && messages.length > 0) {
			const lastId = messages[0].id;
			await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${lastId}`, {
				method: "DELETE",
				headers: { Authorization: `Bot ${BOT_TOKEN}` }
			});
			console.log("🧹 Deleted last message:", lastId);
		}

		// 3. Send new message from Roblox
		const msg = req.body.content || "No content provided.";
		const sendRes = await fetch(
			`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bot ${BOT_TOKEN}`
				},
				body: JSON.stringify({ content: msg })
			}
		);

		const responseBody = await sendRes.json();
		console.log("📤 Sent message:", responseBody.id);
		res.json({ status: "ok", messageId: responseBody.id });

	} catch (err) {
		console.error("❌ Error:", err.message);
		res.status(500).json({ error: err.message });
	}
});

// ==== SERVER & NGROK ====
(async () => {
	app.listen(PORT, () => {
		console.log("🟢 Local server running on port", PORT);
	});

	const url = await ngrok.connect(PORT);
	console.log("🌍 Ngrok public URL:", url + "/send");
})();