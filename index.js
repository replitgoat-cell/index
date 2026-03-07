// ============================================
// MASTER PROCESS (auto‑restart controller)
// ============================================
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  console.log(`🔄 Master process ${process.pid} is running`);

  // Function to start a worker
  const startWorker = () => {
    const worker = cluster.fork();
    console.log(`✅ Worker ${worker.process.pid} started`);
    return worker;
  };

  // Start initial worker
  let worker = startWorker();

  // Restart worker if it dies
  cluster.on('exit', (deadWorker, code, signal) => {
    console.log(`💥 Worker ${deadWorker.process.pid} died. Restarting...`);
    worker = startWorker();
  });

  // Graceful shutdown on master termination
  process.on('SIGINT', () => {
    console.log('🛑 Master shutting down...');
    worker.kill();
    process.exit(0);
  });

} else {
  // ============================================
  // WORKER PROCESS (your original bot)
  // ============================================
  
  // ----- Global error handlers to catch and log crashes -----
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    // Give logs time to flush, then exit
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    setTimeout(() => process.exit(1), 1000);
  });

  // ----- Your original code with User-Agent patches -----
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function(id) {
    const module = originalRequire.apply(this, arguments);
    
    // Patch ClientRequest after requiring http/https modules
    if (id === 'http' || id === 'https') {
      const originalRequest = module.request;
      module.request = function(options, ...args) {
        if (typeof options === 'object' && options !== null && options.headers) {
          // Replace undefined User-Agent with a valid one
          if (options.headers['User-Agent'] === undefined) {
            options.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
          }
        }
        return originalRequest.call(this, options, ...args);
      };
    }
    
    return module;
  };

  // Also patch the Agent setHeader method to reject undefined values
  const http = require('http');
  const https = require('https');
  const ClientRequest = require('http').ClientRequest;
  const OriginalSetHeader = ClientRequest.prototype.setHeader;

  ClientRequest.prototype.setHeader = function(name, value) {
    if (value === undefined) {
      // Silently replace undefined headers with a valid User-Agent
      if (name === 'User-Agent' || name === 'user-agent') {
        value = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      } else {
        return; // Skip undefined headers
      }
    }
    return OriginalSetHeader.call(this, name, value);
  };

  const login = require("aminul-new-fca");
  const fs = require("fs-extra");
  const path = require("path");
  const axios = require("axios");
  const request = require("request");

  // Configuration from environment variables
  const PORT = process.env.PORT || 3000;
  const APPSTATE_JSON = process.env.APPSTATE_JSON;

  // Bot startup time for uptime tracking
  const BOT_START_TIME = Date.now();

  // Define available commands
  const COMMANDS = {
    help: "Show all available commands and bot info",
    hello: "Say hello to the bot",
    uptime: "Show bot uptime",
    uid: "Get your user ID",
    ping: "Ping the bot",
    info: "Show admin information"
  };

  // Get appstate - either from environment variable or file
  let appState;
  if (APPSTATE_JSON) {
    try {
      appState = JSON.parse(APPSTATE_JSON);
      console.log("✅ Using APPSTATE_JSON from environment variable");
    } catch (error) {
      console.error(`❌ ERROR: Invalid APPSTATE_JSON environment variable!`);
      process.exit(1);
    }
  } else if (fs.existsSync("appstate.json")) {
    try {
      appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
      console.log("✅ Using appstate.json from file");
    } catch (error) {
      console.error(`❌ ERROR: Invalid appstate.json file!`);
      process.exit(1);
    }
  } else {
    console.error(`❌ ERROR: Facebook account credentials not found!`);
    console.error(`📌 Please provide either:`);
    console.error(`   1. Set APPSTATE_JSON environment variable with your account credentials (JSON)`);
    console.error(`   2. Add 'appstate.json' file to the project root directory`);
    process.exit(1);
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
    { appState: appState },
    (err, api) => {
      if (err) {
        console.error("❌ Login error:", err);
        process.exit(1); // Exit to trigger restart
      }
      console.log(`🚀 Bot running on port ${PORT}`);
      console.log("✅ Bot Login Success!");

      api.listenMqtt((err, event) => {
        if (err) {
          console.error("❌ listenMqtt error:", err);
          // Don't exit immediately – let the error be handled by global handlers
          return;
        }

        const { body, threadID, messageID, senderID, logMessageType } = event;
        if (!body) {
          // Handle member join/leave events
          if (logMessageType === "log:subscribe") {
            api.sendMessage("👋 Welcome to the group! Use /help to see available commands.", threadID);
          } else if (logMessageType === "log:unsubscribe") {
            api.sendMessage("👋 A member has left the group.", threadID);
          }
          return;
        }

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
        } else if (lowerBody === "uid") {
          api.sendMessage(`👤 Your User ID: ${senderID}`, threadID, messageID);
        } else if (lowerBody === "ping") {
          api.sendMessage("🏓 Pong! I'm online and working perfectly!", threadID, messageID);
        } else if (lowerBody === "info") {
          sendInfoMessage(threadID, messageID, api);
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

  // Info message function
  function sendInfoMessage(threadID, messageID, api) {
    const avatarURL = "https://graph.facebook.com/100071880593545/picture?height=720&width=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";
    const imgPath = path.join(CACHE_DIR, "aminul-avatar.png");

    const callback = () => {
      api.sendMessage({
        body: `╭─〔🌸 𝐀𝐌𝐈𝐍𝐔𝐋𝐁𝐎𝐓 𝐈𝐍𝐅𝐎 🌸〕─╮
│ 💫 **𝐍𝐚𝐦𝐞:** 𝐀𝐦𝐢𝐧𝐮𝐥 𝐒𝐚𝐫𝐝𝐚𝐫
│ 🕌 **𝐑𝐞𝐥𝐢𝐠𝐢𝐨𝐧:** 𝐈𝐬𝐥𝐚𝐦
│ 📍 **𝐅𝐫𝐨𝐦:** 𝐑𝐚𝐣𝐬𝐡𝐚𝐡𝐢, 𝐃𝐡𝐚𝐤𝐚
│ 👦 **𝐆𝐞𝐧𝐝𝐞𝐫:** 𝐌𝐚𝐥𝐞
│ 🎂 **𝐀𝐠𝐞:** 𝟏𝟖+
│ 💞 **𝐑𝐞𝐥𝐚𝐭𝐢𝐨𝐧𝐬𝐡𝐢𝐩:** 𝐒𝐢𝐧𝐠𝐥𝐞
│ 🎓 **𝐖𝐨𝐫𝐤:** 𝐒𝐭𝐮𝐝𝐞𝐧𝐭
│ ✉ **𝐆𝐦𝐚𝐢𝐥:** aminulsordar04@gmail.com
│ 💬 **𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩:** wa.me/+8801704407109
│ 💭 **𝐓𝐞𝐥𝐞𝐠𝐫𝐚𝐦:** t.me/Aminulsordar
│ 🌐 **𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤:** facebook.com/100071880593545
│
╰───〔💛 𝐀𝐌𝐈𝐍𝐔𝐋 𝐗 𝐁𝐎𝐓 💛〕───╯`,
        attachment: fs.createReadStream(imgPath)
      }, threadID, () => fs.unlinkSync(imgPath));
    };

    request(encodeURI(avatarURL))
      .pipe(fs.createWriteStream(imgPath))
      .on("close", callback)
      .on("error", (error) => {
        console.error("❌ Error downloading avatar:", error);
        api.sendMessage("❌ Failed to fetch admin info", threadID, messageID);
      });
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
}
