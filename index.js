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

app.get("/", (_, res) => res.send("🤖 Free Cloudflare Tunnel Proxy is online."));

app.post("/send", async (req, res) => {
  try {
    const last = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=1`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    ).then(r => r.json());

    if (Array.isArray(last) && last[0]) {
      await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${last[0].id}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
      });
      console.log("🧹 Deleted message:", last[0].id);
    }

    const msg = req.body.content || "No content.";
    const res2 = await fetch(
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
    const json = await res2.json();
    console.log("📤 Sent:", json.id);
    res.json({ ok: true, messageId: json.id });

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
  startCloudflareTunnel();
});

// Start free Cloudflare tunnel (random subdomain)
function startCloudflareTunnel() {
  const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`]);

  tunnel.stdout.on("data", data => {
    const output = data.toString();
    const match = output.match(/https:\/\/.*?\.trycloudflare\.com/);
    if (match) {
      console.log("🌍 Tunnel URL:", match[0] + "/send");
    }
  });

  tunnel.stderr.on("data", err => {
    console.error("Tunnel error:", err.toString());
  });

  tunnel.on("close", code => {
    console.log(`💥 Tunnel closed with code ${code}`);
  });
}