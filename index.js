const express = require("express");
const fetch = require("node-fetch");
const app = express();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = process.env.PORT || 3000; // Fallback to 3000 if PORT is not defined

app.use(express.json());

app.post("/send", async (req, res) => {
  try {
    // Delete latest message
    const messages = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=1`,
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`
        }
      }
    ).then(r => r.json());

    if (Array.isArray(messages) && messages.length > 0) {
      const lastMessageId = messages[0].id;
      await fetch(
        `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${lastMessageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${BOT_TOKEN}`
          }
        }
      );
      console.log("✅ Deleted last message:", lastMessageId);
    }

    const msg = req.body.content || "No content received.";

    // Send new message
    const sendRes = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${BOT_TOKEN}`
        },
        body: JSON.stringify({
          content: msg
        })
      }
    );

    const responseBody = await sendRes.json();
    console.log("✅ Sent new message:", responseBody.id);
    res.json({ status: "ok", new_id: responseBody.id });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("Webhook proxy is running."));

app.listen(PORT, () => {
  console.log(`✅ Webhook proxy running at http://localhost:${PORT}`);
});