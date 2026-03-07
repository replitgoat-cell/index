const login = require("aminul-new-fca");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const request = require("request");
const express = require("express");

// EXPRESS SERVER
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Aminul Bot is Running");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// Bot startup
const BOT_START_TIME = Date.now();

// Commands
const COMMANDS = {
  help: "Show all available commands and bot info",
  hello: "Say hello to the bot",
  uptime: "Show bot uptime"
};

// Check appstate
if (!fs.existsSync("appstate.json")) {
  console.error("❌ appstate.json not found!");
  process.exit(1);
}

// Cache folder
const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

// Cleanup old cache
function cleanCache() {
  fs.readdir(CACHE_DIR, (err, files) => {
    if (err) return;
    const now = Date.now();

    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file);

      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (now - stats.mtimeMs > 3600000) { // 1 hour
          fs.unlink(filePath).catch(() => {});
        }
      });
    });
  });
}
setInterval(cleanCache, 1800000); // every 30 minutes

// Default User-Agent for all requests
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36";

// LOGIN
login(
  {
    appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")),
    userAgent: DEFAULT_USER_AGENT
  },
  (err, api) => {
    if (err) {
      console.error("❌ Login error:", err);
      return;
    }

    console.log("✅ Bot Login Success!");

    // LISTEN
    api.listenMqtt((err, event) => {
      if (err) {
        console.error("Listen error:", err);
        return;
      }

      if (!event.body) return;

      const { body, threadID, messageID } = event;
      const text = body.toLowerCase();

      // URL detect
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = body.match(urlRegex);

      if (urls) {
        urls.forEach(url => downloadVideo(url, threadID, messageID, api));
        return;
      }

      // Commands
      switch (text) {
        case "hello":
          api.sendMessage("👋 Hello! I am Aminul Bot", threadID, messageID);
          break;
        case "help":
          api.sendMessage(getHelpMessage(), threadID, messageID);
          break;
        case "uptime":
          api.sendMessage(`⏱ Bot Uptime: ${getUptime()}`, threadID, messageID);
          break;
      }
    });
  }
);

// UPTIME
function getUptime() {
  const ms = Date.now() - BOT_START_TIME;

  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor((ms / (1000 * 60)) % 60);
  const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));

  return `${d}d ${h}h ${m}m ${s}s`;
}

// HELP
function getHelpMessage() {
  let msg = `📋 BOT COMMANDS\n\n`;

  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    msg += `/${cmd} - ${desc}\n`;
  }

  msg += `\n📥 Send a video URL to auto-download`;

  return msg;
}

// VIDEO DOWNLOAD
async function downloadVideo(url, threadID, messageID, api) {
  try {
    api.sendMessage("⏬ Downloading video...", threadID, messageID);

    const apiURL =
      "https://aminul-rest-api-three.vercel.app/downloader/alldownloader?url=" +
      encodeURIComponent(url);

    const res = await axios.get(apiURL, {
      headers: { "User-Agent": DEFAULT_USER_AGENT }
    });

    const data = res?.data?.data?.data;

    if (!data) {
      api.sendMessage("❌ Video data not found", threadID, messageID);
      return;
    }

    const videoURL = data.high || data.low;

    if (!videoURL) {
      api.sendMessage("❌ Download link not found", threadID, messageID);
      return;
    }

    const filePath = path.join(CACHE_DIR, `video_${Date.now()}.mp4`);

    request({ url: videoURL, headers: { "User-Agent": DEFAULT_USER_AGENT } })
      .pipe(fs.createWriteStream(filePath))
      .on("close", () => {
        api.sendMessage(
          {
            body: `🎬 ${data.title || "Video"}`,
            attachment: fs.createReadStream(filePath)
          },
          threadID,
          () => fs.unlink(filePath).catch(() => {}),
          messageID
        );
      });
  } catch (err) {
    console.error(err);
    api.sendMessage("❌ Download error", threadID, messageID);
  }
}
