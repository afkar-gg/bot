const express = require("express"), fetch = require("node-fetch"), { spawn } = require("child_process");
const config = require("./config.json");
const BOT_TOKEN = config.BOT_TOKEN, CHANNEL = config.CHANNEL_ID;
const DASH_PASS = config.DASHBOARD_PASSWORD || "secret";
if (!BOT_TOKEN) { console.error("Missing BOT_TOKEN"); process.exit(1); }

const PORT = 3000;
const app = express();
app.use(express.json());
app.use(require("cookie-parser")());

// In-memory job store & sessions
const pending = new Map(); // username -> job details
const sessions = new Map();
const lastSeen = new Map();

// --- Auth Middleware ---
function requireAuth(req, res, next) {
  if (req.path.startsWith("/status") || req.path === "/login" || req.path === "/login-submit") return next();
  if (req.cookies?.dash_auth === DASH_PASS) return next();
  res.redirect("/login");
}
app.use(requireAuth);

// --- Login Page ---
app.get("/login", (req, res) => {
  res.send(`
    <form method="POST" action="/login-submit">
      <input name="password" type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  `);
});
app.post("/login-submit", express.urlencoded({ extended: false }), (req, res) => {
  if (req.body.password === DASH_PASS) {
    res.cookie("dash_auth", DASH_PASS, { httpOnly: true });
    return res.redirect("/dashboard");
  }
  res.send("Invalid password. <a href='/login'>Retry</a>");
});

// --- Dashboard ---
app.get("/dashboard", (req, res) => {
  const rows = Array.from(pending.values()).map(j =>
    `<tr>
      <td>${j.username}</td>
      <td>${j.no_order}</td>
      <td>${j.nama_store}</td>
      <td>${Math.max(0, Math.floor((j.endTime - Date.now())/60000))}m</td>
      <td>${j.status}</td>
      <td><button onclick="fetch('/cancel/${j.username}').then(()=>location.reload())">Cancel</button></td>
    </tr>`
  ).join("");

  res.send(`
    <h1>Dashboard</h1>
    <form id="jobForm">
      <input name="username" placeholder="Username"/><br/>
      <input name="no_order" placeholder="Order ID"/><br/>
      <input name="nama_store" placeholder="Store"/><br/>
      <input name="jam_selesai_joki" placeholder="Hours"/><br/>
      <button type="submit">Start Job</button>
    </form>
    <h2>Active Jobs</h2>
    <table border="1">
      <tr><th>User</th><th>Order</th><th>Store</th><th>Time Left</th><th>Status</th><th>Action</th></tr>
      ${rows}
    </table>
    <script>
      document.getElementById("jobForm").onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        await fetch("/start-job", { method:"POST", body:JSON.stringify(Object.fromEntries(f)), headers:{"Content-Type":"application/json"} });
        location.reload();
      };
    </script>
  `);
});

// --- Job Control ---
app.post("/start-job", (req, res) => {
  const { username, no_order, nama_store, jam_selesai_joki } = req.body;
  const endTime = Date.now() + (+jam_selesai_joki * 3600000);
  pending.set(username, { username, no_order, nama_store, endTime, status: "waiting" });
  res.json({ ok: true });
});

app.get("/cancel/:username", (req, res) => {
  const u = req.params.username;
  pending.delete(u);
  sessions.get(u) && sessions.delete(u);
  res.redirect("/dashboard");
});

// --- Roblox Endpoints ---
app.post("/track", (req, res) => {
  const { username } = req.body;
  if (!pending.has(username)) return res.status(404).json({ error: "No matching job" });

  const job = pending.get(username);
  pending.delete(username);

  const startTime = Date.now();
  const s = { ...job, startTime, messageId: null, channel: CHANNEL, warned: false, offline: false, endTime: job.endTime };
  sessions.set(username, s);
  lastSeen.set(username, Date.now());

  const now = Math.floor(startTime/1000), end = Math.floor(job.endTime/1000);
  const clean = job.no_order.replace(/^OD000000/, "");
  const embed = {
    embeds: [{
      title: "🎮 **JOKI STARTED**",
      description:
        `**Username:** ${username}\n` +
        `**Order ID:** ${job.no_order}\n` +
        `[🔗 View Order](`+
          `https://tokoku.itemku.com/riwayat-pesanan/rincian/${clean})\n\n` +
        `**Start:** <t:${now}:f>\n**End:** <t:${end}:f>`,
      footer: { text: `- ${job.nama_store}` }
    }]
  };

  fetch(`https://discord.com/api/v10/channels/${CHANNEL}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify(embed)
  }).then(r => r.json())
    .then(data => { s.messageId = data.id; })
    .catch(console.error);

  res.json({ ok: true, endTime: s.endTime });
});

app.post("/check", (req, res) => {
  const { username } = req.body;
  const s = sessions.get(username);
  if (!s) return res.status(404).json({ error: "No session" });
  lastSeen.set(username, Date.now());
  fetch(`https://discord.com/api/v10/channels/${s.channel}/messages/${s.messageId}`, {
    method: "PATCH",
    headers: { "Content-Type":"application/json", Authorization:`Bot ${BOT_TOKEN}` },
    body: JSON.stringify({ content: `🟢 Online — Last Checked: <t:${Math.floor(Date.now()/1000)}:R>` })
  }).catch(console.error);
  res.json({ ok: true });
});

app.post("/complete", (req, res) => {
  const { username } = req.body;
  const s = sessions.get(username);
  if (!s) return res.status(404).json({ error: "No session" });

  const now = Math.floor(Date.now()/1000);
  const clean = s.no_order.replace(/^OD000000/, "");
  const embed = {
    embeds: [{
      title: "✅ **JOKI COMPLETED**",
      description:
        `**Username:** ${username}\n` +
        `**Order ID:** ${s.no_order}\n` +
        `[🔗 View Order](`+
          `https://tokoku.itemku.com/riwayat-pesanan/rincian/${clean})\n\n` +
        `⏰ Completed at: <t:${now}:f>`,
      footer: { text: `- ${s.nama_store}` }
    }]
  };

  fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
    method: "POST",
    headers: { "Content-Type":"application/json", Authorization:`Bot ${BOT_TOKEN}` },
    body: JSON.stringify(embed)
  }).catch(console.error);

  sessions.delete(username);
  lastSeen.delete(username);
  res.json({ ok: true });
});

app.post("/send-job", (req, res) => {
  const { username, placeId, jobId, join_url } = req.body;
  const s = sessions.get(username);
  if (!s) return res.status(404).json({ error:"No session" });

  const embed = {
    embeds: [{
      title: `🧩 Job ID for ${username}`,
      description: `**Place ID:** \`${placeId}\`\n**Job ID:** \`${jobId}\``,
      color: 0x3498db,
      fields: [{ name: "Join Link", value: `[Click to Join](${join_url})` }]
    }]
  };
  fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
    method: "POST",
    headers: { "Content-Type":"application/json", Authorization:`Bot ${BOT_TOKEN}` },
    body: JSON.stringify(embed)
  }).catch(console.error);

  res.json({ ok: true });
});

// Public status check
app.get("/status/:username", (req, res) => {
  const u = req.params.username;
  const s = sessions.get(u), seen = lastSeen.get(u);
  if (!s) return res.status(404).json({ error:`No session for ${u}` });

  const now = Date.now();
  const ago = seen && (now - seen < 300000) ? seen : null;
  res.json({
    username: u,
    endTime: s.endTime,
    lastSeen: ago || "offline"
  });
});

// Watchdog
setInterval(() => {
  const now = Date.now();
  sessions.forEach((s, u) => {
    const seen = lastSeen.get(u) || 0;

    if (!s.warned && now > s.endTime) {
      fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bot ${BOT_TOKEN}`},
        body:JSON.stringify({ content:`⏳ ${u}'s joki ended.` })
      });
      s.warned = true;
    }

    if (!s.offline && now - seen > 180000) {
      fetch(`https://discord.com/api/v10/channels/${s.channel}/messages`, {
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bot ${BOT_TOKEN}`},
        body:JSON.stringify({ content:`🔴 @everyone — **${u} is OFFLINE.** No heartbeat for 3 minutes.` })
      });
      s.offline = true;
    }
  });
}, 60000);

// Launch proxy + tunnel
app.listen(PORT, () => {
  console.log(`✅ Proxy live on port ${PORT}`);
  const tun = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`, "--loglevel", "info"]);
  const procLine = m => {
    const l = m.toString();
    if (l.includes("trycloudflare.com")) console.log("🌐 Tunnel URL:", l.trim());
  };
  tun.stdout.on("data", procLine);
  tun.stderr.on("data", procLine);
});