const express = require("express");
const fetch = require("node-fetch");
const { spawn } = require("child_process");
const config = require("./config.json");

const BOT_TOKEN = config.BOT_TOKEN;
const FALLBACK_CHANNEL_ID = config.CHANNEL_ID;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing.");
  process.exit(1);
}

const PORT = Math.floor(Math.random() * 3001) + 1000;
const app = express();
app.use(express.json());

const sessions = new Map();
const lastSeen = new Map();

// === /send ===
app.post("/send", async (req, res) => {
  const {
    username = "Unknown",
    jam_selesai_joki = 1,
    no_order = "OD000000000000",
    nama_store = "AfkarStore"
  } = req.body;

  const channel = FALLBACK_CHANNEL_ID;
  const now = Math.floor(Date.now() / 1000);
  const end = now + jam_selesai_joki * 3600;
  const orderIdClean = no_order.replace("OD000000", "");

  const embed = {
    embeds: [{
      title: "🎮 **JOKI STARTED**",
      color: 0x2ecc71,
      description: [
        `**Username:** ${username}`,
        `**Order ID:** ${no_order}`,
        `[🔗 View Order History](https://tokoku.itemku.com/riwayat-pesanan/rincian/${orderIdClean})`,
        "",
        `**Start:** <t:${now}:f>`,
        `**End:** <t:${end}:f>`
      ].join("\n"),
      footer: { text: `- ${nama_store} ❤️` }
    }]
  };

  try {
    const resp = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`
      },
      body: JSON.stringify(embed)
    });
    const data = await resp.json();

    if (!resp.ok || !data.id) {
      return res.status(500).json({ error: "Discord message failed" });
    }

    sessions.set(username, {
      messageId: data.id,
      channel,
      endTime: end * 1000,
      warned: false
    });

    lastSeen.set(username, Date.now());
    res.json({ ok: true, id: data.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === /check ===
app.post("/check", async (req, res) => {
  const { username } = req.body;
  const s = sessions.get(username);
  if (!s) return res.status(404).json({ error: "No session" });

  lastSeen.set(username, Date.now());
  const nowUnix = Math.floor(Date.now() / 1000);

  try {
    await fetch(`https://discord.com/api/v10/channels/${s.channel}/messages/${s.messageId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`
      },
      body: JSON.stringify({
        content: `🟢 **Online Checked** — **Username:** ${username}\nLast Checked: <t:${nowUnix}:R>`,
        allowed_mentions: { parse: [] }
      })
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === /complete ===
app.post("/complete", async (req, res) => {
  const { username, no_order = "OD000000000000", nama_store = "AfkarStore" } = req.body;
  const s = sessions.get(username);
  if (!s) return res.status(404).json({ error: "No session" });

  const now = Math.floor(Date.now() / 1000);
  const orderIdClean = no_order.replace("OD000000", "");

  try {
    await fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`
      },
      body: JSON.stringify({
        embeds: [{
          title: "✅ **JOKI COMPLETED**",
          color: 0x2ecc71,
          description: [
            `**Username:** ${username}`,
            `**Order ID:** ${no_order}`,
            `[🔗 View Order History](https://tokoku.itemku.com/riwayat-pesanan/rincian/${orderIdClean})`,
            "",
            `⏰ Completed at: <t:${now}:f>`,
            `❤️ Thank you for using ${nama_store} ❤️`
          ].join("\n")
        }]
      })
    });

    sessions.delete(username);
    lastSeen.delete(username);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === /cancel ===
app.post("/cancel", async (req, res) => {
  const { username } = req.body;
  const s = sessions.get(username);
  if (!s) return res.status(404).json({ error: "No session" });

  try {
    await fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`
      },
      body: JSON.stringify({ content: `❌ ${username}'s session was cancelled.` })
    });
    sessions.delete(username);
    lastSeen.delete(username);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === /send-job ===
app.post("/send-job", async (req, res) => {
  const { jobId = "Unknown", username = "User", join_url = "", placeId = "N/A" } = req.body;
  const s = sessions.get(username);
  if (!s) return res.status(404).json({ error: "No session" });

  try {
    await fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`
      },
      body: JSON.stringify({
        embeds: [{
          title: `🧩 Job ID for ${username}`,
          description: `**Place ID:** \`${placeId}\`\n**Job ID:** \`${jobId}\``,
          fields: [{
            name: "Join Link",
            value: `[Click to Join Game](${join_url})`
          }],
          color: 0x3498db
        }]
      })
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === /resume ===
app.post("/resume", (req, res) => {
  const { username } = req.body;
  const s = sessions.get(username);
  if (!s) return res.status(404).json({ error: "No active session" });

  res.json({
    ok: true,
    endTime: s.endTime,
    messageId: s.messageId,
    channel: s.channel
  });
});

// === /status === (HTML UI + API)
app.get("/status", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Joki Status</title>
    <style>
      body { font-family: sans-serif; background: #111; color: #fff; padding: 40px; text-align: center; }
      input, button { padding: 10px; font-size: 16px; margin: 5px; }
      .result { margin-top: 20px; font-size: 18px; }
    </style>
  </head>
  <body>
    <h1>🔎 Check Joki Status</h1>
    <input id="userInput" type="text" placeholder="Enter username" />
    <button onclick="checkStatus()">Check</button>
    <div id="result" class="result"></div>

    <script>
      async function checkStatus() {
        const user = document.getElementById("userInput").value.trim();
        if (!user) return;

        const res = await fetch("/status/" + user);
        const data = await res.json();
        const r = document.getElementById("result");

        if (data.error) {
          r.innerText = "❌ " + data.error;
        } else if (data.lastSeen === "offline") {
          r.innerHTML = \`🧍‍♂️ <b>\${user}</b> is <span style="color:red;font-weight:bold;">OFFLINE</span><br/>No heartbeat for 10+ minutes.\`;
        } else {
          const left = Math.floor((data.endTime - Date.now()) / 1000);
          const mins = Math.floor(left / 60);
          const secs = left % 60;
          const lastSeenAgo = Math.floor((Date.now() - data.lastSeen) / 60000);

          r.innerHTML = \`
            🧍‍♂️ <b>\${user}</b> is <span style="color:lime;font-weight:bold;">ONLINE</span><br/>
            🕒 Time left: \${mins}m \${secs}s<br/>
            👁️ Last Checked: \${lastSeenAgo} min ago (0 = <60 Sec)
          \`;
        }
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

app.get("/status/:username", (req, res) => {
  const username = req.params.username;
  const s = sessions.get(username);
  const seen = lastSeen.get(username);

  if (!s) {
    return res.status(404).json({ error: "No session found for " + username });
  }

  const now = Date.now();
  const isOffline = !seen || (now - seen > 10 * 60 * 1000);

  res.json({
    username,
    endTime: s.endTime,
    status: isOffline ? "offline" : "online",
    lastSeen: isOffline ? "offline" : seen
  });
});

// === /join ===
app.get("/join", (req, res) => {
  const placeId = req.query.place;
  const jobId = req.query.job;

  if (!placeId || !jobId) {
    return res.status(400).send("Missing placeId or jobId");
  }

  const robloxUri = `roblox://experiences/start?placeId=${placeId}&gameId=${jobId}`;
  const fallbackHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Join Roblox Game</title>
      <style>
        body { font-family: sans-serif; background: #111; color: #fff; padding: 40px; text-align: center; }
        a { color: #88f; font-size: 18px; text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>🔗 Join Roblox Session</h1>
      <p>If you are not redirected, click the link below to open Roblox manually:</p>
      <a href="${robloxUri}">Click here to join the game</a>
    </body>
    </html>
  `;
  res.set("Content-Type", "text/html");
  res.send(fallbackHTML);
});

// === Watchdog ===
setInterval(() => {
  const now = Date.now();

  for (const [username, s] of sessions.entries()) {
    const last = lastSeen.get(username) || 0;

    // Notify end
    if (now > s.endTime && !s.warned) {
      fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${BOT_TOKEN}`
        },
        body: JSON.stringify({ content: `⏳ ${username}'s joki ended.` })
      }).then(() => {
        s.warned = true;
      });
    }

    // Detect offline
    if (!s.offline && now - last >= 10 * 60 * 1000) {
      fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${BOT_TOKEN}`
        },
        body: JSON.stringify({
          content: `🔴 @everyone — **${username} is OFFLINE.** No heartbeat for 10 minutes.`
        })
      }).then(() => {
        s.offline = true;
      });
    }

    // Auto clean
    if (now > s.endTime + 300000) {
      sessions.delete(username);
      lastSeen.delete(username);
    }
  }
}, 60000);

// === Start Server + Tunnel ===
app.listen(PORT, () => {
  console.log(`✅ Proxy live on port ${PORT}`);

  const tunnel = spawn("cloudflared", [
    "tunnel",
    "--url", `http://localhost:${PORT}`,
    "--loglevel", "error"
  ]);

  tunnel.stdout.on("data", (data) => {
    const output = data.toString();
    if (output.includes("trycloudflare.com")) {
      console.log(`🌐 Cloudflare URL: ${output.trim()}`);
    }
  });

  tunnel.stderr.on("data", (err) => {
    const msg = err.toString();
    if (!msg.includes("refreshing dns")) {
      console.error("⚠️ Cloudflared:", msg.trim());
    }
  });
});