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

const PORT = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000;
const app = express();
app.use(express.json());

// === /send-job — Send Job ID as embed
app.post("/send-job", async (req, res) => {
	const { username, jobId, placeId, join_url } = req.body;

	if (!username || !jobId || !placeId || !join_url) {
		return res.status(400).json({ error: "Missing job info." });
	}

	const embed = {
		embeds: [{
			title: "📡 Roblox Job ID",
			color: 0x00ffff,
			description: `**Username:** \`${username}\`\n🔗 [Join Server](${join_url})`
		}]
	};

	try {
		const response = await fetch(`https://discord.com/api/v10/channels/${FALLBACK_CHANNEL_ID}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bot ${BOT_TOKEN}`
			},
			body: JSON.stringify(embed)
		});

		const json = await response.json();
		console.log("✅ Job ID sent:", json.id);
		res.json({ ok: true });
	} catch (err) {
		console.error("❌ Failed to send job ID:", err.message);
		res.status(500).json({ error: err.message });
	}
});

// === Store per-user sessions and check-in status
const sessions = new Map(); // username → { messageId, channelId, startTime, duration, warned }
const lastSeen = new Map(); // username → { time, channelId, warned }

app.get("/", (_, res) => res.send("🤖 Proxy is alive."));

// === /send — JOKI STARTED ===
app.post("/send", async (req, res) => {
	const {
		username = "Unknown",
		jam_selesai_joki = 1,
		no_order = "OD000000000000",
		nama_store = "Unknown Store",
		channel_id
	} = req.body;

	const finalChannelId = channel_id || FALLBACK_CHANNEL_ID;
	const orderCode = no_order.replace("OD000000", "") || "000000000000";
	const link = `https://tokoku.itemku.com/riwayat-pesanan/rincian/${orderCode}`;
  
  const embed = {
  	embeds: [{
	  	title: "🎮 JOKI STARTED",
	  	color: 65280,
	  	description: `**Username:** ${username}
  **Order ID:** ${no_order}
  🔗 [View Order History](${link})
   
  **Start:** <t:${Math.floor(Date.now() / 1000)}:F>
  **End:** <t:${Math.floor(Date.now() / 1000) + (Number(jam_selesai_joki) * 3600)}:F>
  
  - ${nama_store} ❤️`,
      footer: {
			  text: "Joki Service Bot • Powered by Afkar",
		  	icon_url: "https://cdn-icons-png.flaticon.com/512/4712/4712109.png" // optional
	  	}
	  }]
  };
  
	try {
		const response = await fetch(`https://discord.com/api/v10/channels/${finalChannelId}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bot ${BOT_TOKEN}`
			},
			body: JSON.stringify(embed)
		});

		const json = await response.json();
		console.log("✅ Joki Started:", json.id);

		sessions.set(username, {
			messageId: json.id,
			channelId: finalChannelId,
			startTime: Date.now(),
			duration: jam_selesai_joki * 3600,
			warned: false
		});

		res.json({ ok: true, id: json.id });
	} catch (err) {
		console.error("❌ Failed to send embed:", err.message);
		res.status(500).json({ error: err.message });
	}
});

// === /check — only edit your own message
app.post("/check", async (req, res) => {
	const { username = "Unknown" } = req.body;
	const session = sessions.get(username);
	if (!session) {
		console.warn(`⚠️ No session found for ${username}`);
		return res.status(404).json({ error: "No active session for this user." });
	}

	const content = `🟢 Online Checked — Username: ${username}\nLast Checked: <t:${Math.floor(Date.now() / 1000)}:R>`;

	lastSeen.set(username, {
		time: Date.now(),
		channel_id: session.channelId,
		warned: false
	});

	try {
		await fetch(`https://discord.com/api/v10/channels/${session.channelId}/messages/${session.messageId}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bot ${BOT_TOKEN}`
			},
			body: JSON.stringify({ content })
		});
		console.log(`✏️ Edited check-in for ${username}`);
		res.json({ edited: true });
	} catch (err) {
		console.error("❌ Failed to edit message:", err.message);
		res.status(500).json({ error: err.message });
	}
});

// === /complete — JOKI DONE
app.post("/complete", async (req, res) => {
	const {
		username = "Unknown",
		no_order = "OD000000000000",
		nama_store = "Unknown Store"
	} = req.body;

	const session = sessions.get(username);
	const channelId = session?.channelId || FALLBACK_CHANNEL_ID;
	const orderCode = no_order.replace("OD", "") || "000000000000";
	const link = `https://tokoku.itemku.com/riwayat-pesanan/rincian/${orderCode}`;

	const embed = {
		embeds: [{
			title: "✅ JOKI COMPLETED",
			color: 16776960,
			description: `**Username:** ${username}
**Order ID:** ${no_order}
🔗 [View Order History](${link})

⏱️ Completed at: <t:${Math.floor(Date.now() / 1000)}:F>
❤️ Thank you for using ${nama_store} ❤️`
		}]
	};

	try {
		const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bot ${BOT_TOKEN}`
			},
			body: JSON.stringify(embed)
		});

		const json = await response.json();
		console.log("🏁 Completion sent:", json.id);
		res.json({ ok: true, id: json.id });
	} catch (err) {
		console.error("❌ Failed to send completion:", err.message);
		res.status(500).json({ error: err.message });
	}
});

// === Bot status ONLINE
async function setBotPresence() {
	try {
		await fetch("https://discord.com/api/v10/users/@me/settings", {
			method: "PATCH",
			headers: {
				Authorization: `Bot ${BOT_TOKEN}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ status: "online" })
		});
		console.log("✅ Bot status set to online");
	} catch (err) {
		console.error("❌ Failed to set presence:", err.message);
	}
}

// === Offline Watchdog — Warn if inactive >10 min
setInterval(async () => {
	const now = Date.now();
	for (const [username, session] of sessions.entries()) {
		const last = lastSeen.get(username);
		const elapsed = last ? (now - last.time) / 1000 : Infinity;

		if (elapsed > 600 && !session.warned) {
			try {
				await fetch(`https://discord.com/api/v10/channels/${session.channelId}/messages`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bot ${BOT_TOKEN}`
					},
					body: JSON.stringify({
						content: `🔴 @everyone — **${username} is OFFLINE.** No heartbeat for 10 minutes.`
					})
				});
				console.log(`⚠️ Sent offline warning for ${username}`);
				session.warned = true;
			} catch (err) {
				console.error("❌ Failed to send warning:", err.message);
			}
		} else if (elapsed <= 600 && session.warned) {
			session.warned = false;
		}
	}
}, 60 * 1000);

// === Launch tunnel + server
app.listen(PORT, () => {
	console.log(`🟢 Proxy running on port ${PORT}`);
	startTunnel();
	setTimeout(setBotPresence, 1000);
});

function startTunnel() {
	const tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`]);

	tunnel.stdout.on("data", data => {
		const out = data.toString();
		const match = out.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
		if (match) {
			console.log("🌍 Tunnel URL:", match[0]);
			console.log("➡️ Ready: /send /check /complete");
		}
	});

	tunnel.stderr.on("data", err => {
		console.error("Tunnel error:", err.toString());
	});

	tunnel.on("close", code => {
		console.log("Tunnel closed:", code);
	});
}
