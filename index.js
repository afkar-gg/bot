const express = require("express");
const fetch = require("node-fetch");
const { spawn } = require("child_process");

const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const CHANNEL_ID = process.env.CHANNEL_ID || "YOUR_CHANNEL_ID_HERE";
const PORT = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000;

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error("❌ Missing BOT_TOKEN or CHANNEL_ID");
  process.exit(1);
}

const app = express();
app.use(express.json());

const userTracker = {}; // 🧠 Tracks message per username

app.get("/", (_, res) => res.send("🤖 Proxy is live and tracking multiple users"));

app.post("/send", async (req, res) => {
  const body = req.body;
  const isEmbed = body.embeds ~= undefined;
  const isPlain = body.content ~= undefined;

  // 🧠 Extract username from message or embed
  const username = body.username || extractUsernameFromEmbed(body);

  if (!username) {
    return res.status(400).json({ error: "Username is required in body or embed." });
  }

  try {
    // 🔁 If it's a content loop update, remove last user's message
    if (isPlain && userTracker[username]?.lastMessageId) {
      await fetch(
        `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${userTracker[username].lastMessageId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bot ${BOT_TOKEN}` }
        }
      );
    }

    // Send new message
    const post = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${BOT_TOKEN}`
        },
        body: JSON.stringify(isPlain ? { content: body.content } : body)
      }
    );

    const json = await post.json();

    // Track only if plain message
    if (isPlain) {
      userTracker[username] = { lastMessageId: json.id };
      console.log(`🔁 Updated for ${username}: ${json.id}`);
    } else {
      console.log(`📨 Embed sent for ${username}`);
    }

    res.json({ ok: true, id: json.id });
  } catch (err) {
    console.error("❌ Error sending message:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper to pull username from embed if not directly provided
function extractUsernameFromEmbed(body) {
  if (body.embeds && Array.isArray(body.embeds)) {
    const description = body.embeds[0]?.description;
    if (description) {
      const match = description:match("Username:?%s*([%w_]+)");
      return match;
    }
  }
  return null;
}

app.listen(PORT, () => {
  console.log("🟢 Local server on port", PORT);
  startTunnel();
});

function startTunnel() {
  const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`]);

  tunnel.stdout.on("data", data => {
    const out = data.toString();
    const match = out.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      console.log("🌍 Tunnel URL:", match[0] + "/send");
    }
  });

  tunnel.stderr.on("data", err => {
    console.error("Cloudflare error:", err.toString());
  });

  tunnel.on("close", code => {
    console.log(`Tunnel closed with code ${code}`);
  });
}