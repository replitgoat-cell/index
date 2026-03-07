const login = require("aminul-new-fca");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const request = require("request");

// Bot startup time for uptime tracking
const BOT_START_TIME = Date.now();

// Define available commands
const COMMANDS = {
  help: "Show all available commands and bot info",
  hello: "Say hello to the bot",
  uptime: "Show bot uptime"
};

// Check if required files exist
const requiredFiles = ["appstate.json"];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ ERROR: Required file '${file}' not found!`);
    console.error(`📌 Please add the '${file}' to the project root directory.`);
    process.exit(1);
  }
}

// Ensure cache folder exists
const CACHE_DIR = path.join(__dirname, "cache");
fs.ensureDirSync(CACHE_DIR);

// Clean up old cache files (older than 1 hour)
function cleanCache() {
  fs.readdir(CACHE_DIR, (err, files) => {
    if (err) return console.error("❌ Cache cleanup error:", err);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > 3600000) { // 1 hour
          fs.unlink(filePath).catch(console.error);
        }
      });
    });
  });
}

// Schedule cache cleanup every 30 minutes
setInterval(cleanCache, 1800000);

// Bot login
login(
  { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
  (err, api) => {
    if (err) return console.error(err);

    console.log("✅ Bot Login Success!");

    api.listenMqtt((err, event) => {
      if (err) return console.error(err);

      const { body, threadID, messageID } = event;
      if (!body) return;

      const lowerBody = body.toLowerCase();

      // Auto-download URL
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = body.match(urlRegex);
      if (urls && urls.length > 0) {
        urls.forEach(url => downloadVideo(url, threadID, messageID, api));
      } else if (lowerBody === "hello") {
        api.sendMessage("hello i am aminul bot", threadID, messageID);
      } else if (lowerBody === "help") {
        api.sendMessage(getHelpMessage(), threadID, messageID);
      } else if (lowerBody === "uptime") {
        api.sendMessage(`⏱ Bot Uptime: ${getUptime()}`, threadID, messageID);
      }
    });
  }
);

// Uptime helper
function getUptime() {
  const uptimeMs = Date.now() - BOT_START_TIME;
  const seconds = Math.floor((uptimeMs / 1000) % 60);
  const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
  const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Help message
function getHelpMessage() {
  let helpText = `📋 Bot Help - Total Commands: ${Object.keys(COMMANDS).length}\n\n`;
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    helpText += `/${cmd} - ${desc}\n`;
  }
  helpText += `\n💬 Or send a video URL to auto-download!`;
  return helpText;
}

// Video downloader
async function downloadVideo(url, threadID, messageID, api) {
  try {
    api.sendMessage("⏬ Downloading video...", threadID, messageID);

    const apiURL = `https://aminul-rest-api-three.vercel.app/downloader/alldownloader?url=${encodeURIComponent(url)}`;
    const res = await axios.get(apiURL);
    const data = res?.data?.data?.data;

    if (!data) return api.sendMessage("❌ Video data পাওয়া যায়নি।", threadID, messageID);

    const { title, high, low } = data;
    const videoURL = high || low;
    if (!videoURL) return api.sendMessage("❌ Download link পাওয়া যায়নি।", threadID, messageID);

    const filePath = path.join(CACHE_DIR, `autolink_${Date.now()}.mp4`);
    request(videoURL)
      .pipe(fs.createWriteStream(filePath))
      .on("close", () => {
        api.sendMessage(
          { body: `🎬 𝗧𝗜𝗧𝗟𝗘:\n${title || "Unknown"}`, attachment: fs.createReadStream(filePath) },
          threadID,
          () => fs.unlink(filePath).catch(err => console.error("❌ Error deleting file:", err)),
          messageID
        );
      })
      .on("error", (error) => {
        console.error("Download error:", error);
        api.sendMessage("❌ Video download failed!", threadID, messageID);
      });
  } catch (error) {
    console.error("Error in downloadVideo:", error);
    api.sendMessage("❌ An error occurred while processing your request.", threadID, messageID);
  }
}