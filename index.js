const express = require("express");
const fetch = require("node-fetch");
const { spawn } = require("child_process");

const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const CHANNEL_ID = process.env.CHANNEL_ID || "YOUR_CHANNEL_ID_HERE";

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error("❌ BOT_TOKEN or CHANNEL_ID missing.");
  process.exit(1);
}

const PORT = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000;

const app = express();
app.use(express.json());

app.get("/", (_, res) => res.send("🤖 Bot Proxy is running."));

app.post("/send", async (req, res) => {
  try {
    // 1. Fetch and delete last message
    const last = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=1`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    ).then(r => r.json());

    if (Array.isArray(last) && last.length > 0) {
      const msgId = last[0].id;
      await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${msgId}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
      });
      console.log("🧹 Deleted message:", msgId);
    }

    // 2. Send new message
    const msg = req.body.content || "No content provided.";
    const response = await fetch(
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

    const json = await response.json();
    console.log("📤 Sent message:", json.id);
    res.json({ status: "ok", messageId: json.id });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start local server
app.listen(PORT, () => {
  console.log(`🟢 Local server running on port ${PORT}`);
  startNgrok(PORT);
});

// Ngrok spawn (Termux-compatible)
function startNgrok(port) {
  const ng = spawn("ngrok", ["http", port]);

  ng.stdout.on("data", (data) => {
    const output = data.toString();
    const match = output.match(/https:\/\/[a-z0-9\-]+\.ngrok\.io/);
    if (match) {
      console.log("🌍 Ngrok public URL:", match[0] + "/send");
    }
  });

  ng.stderr.on("data", (data) => {
    console.error(`ngrok error: ${data}`);
  });

  ng.on("close", (code) => {
    console.log(`ngrok closed with code ${code}`);
  });
}