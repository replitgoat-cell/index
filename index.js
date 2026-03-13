// ============================================
// MASTER PROCESS (auto‑restart controller)
// ============================================
const cluster = require('cluster');
const os = require('os');
const express = require('express');

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
  // WORKER PROCESS (your original bot with fixes)
  // ============================================

  // ----- Global error handlers -----
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    setTimeout(() => process.exit(1), 1000);
  });

  // Set process title for easier identification
  process.title = `aminul-bot-worker-${process.pid}`;

  // ----- Your original code with User-Agent patches -----
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function(id) {
    const module = originalRequire.apply(this, arguments);

    if (id === 'http' || id === 'https') {
      const originalRequest = module.request;
      module.request = function(options, ...args) {
        if (typeof options === 'object' && options !== null && options.headers) {
          if (options.headers['User-Agent'] === undefined) {
            options.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
          }
        }
        return originalRequest.call(this, options, ...args);
      };
    }

    return module;
  };

  const http = require('http');
  const https = require('https');
  const ClientRequest = require('http').ClientRequest;
  const OriginalSetHeader = ClientRequest.prototype.setHeader;

  ClientRequest.prototype.setHeader = function(name, value) {
    if (value === undefined) {
      if (name === 'User-Agent' || name === 'user-agent') {
        value = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      } else {
        return;
      }
    }
    return OriginalSetHeader.call(this, name, value);
  };

  const login = require("aminul-new-fca");
  const fs = require("fs-extra");
  const path = require("path");
  const axios = require("axios");
  const request = require("request");

  // Configuration
  const PORT = process.env.PORT || 3000;
  const APPSTATE_JSON = process.env.APPSTATE_JSON;
  const BOT_START_TIME = Date.now();

  // Express server setup
  const app = express();

  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Aminul Bot Status</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
          .card { background: rgba(255,255,255,0.1); border-radius: 10px; padding: 30px; margin: 20px; }
          h1 { font-size: 3em; margin-bottom: 20px; }
          .status { font-size: 1.5em; margin: 20px 0; }
          .badge { background: #4CAF50; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🤖 Aminul Bot</h1>
          <div class="badge">🟢 ONLINE</div>
          <div class="status">
            <p>✅ Bot is running successfully!</p>
            <p>⏱ Uptime: ${getUptime()}</p>
            <p>📊 Total Commands: ${Object.keys(COMMANDS).length}</p>
            <p>🆔 Process ID: ${process.pid}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // Enhanced health check endpoint
  app.get('/health', (req, res) => {
    const isBotAlive = mqttListener && mqttListener.listening;
    res.json({ 
      status: isBotAlive ? 'healthy' : 'degraded',
      bot_status: isBotAlive ? 'listening' : 'disconnected',
      uptime: getUptime(),
      pid: process.pid,
      message_queue: messageQueue.length,
      reconnect_attempts: reconnectAttempts,
      timestamp: new Date().toISOString()
    });
  });

  // Start web server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server is running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use!`);
      console.log('🔄 Trying to kill the process using this port...');

      // Try to kill the process using this port (Linux/Mac only)
      const { exec } = require('child_process');
      exec(`lsof -ti:${PORT} | xargs kill -9`, (err) => {
        if (err) {
          console.error('❌ Could not kill the process. Please manually free the port.');
          process.exit(1);
        } else {
          console.log('✅ Port freed. Restarting...');
          setTimeout(() => process.exit(1), 1000);
        }
      });
    } else {
      console.error('❌ Server error:', error);
    }
  });

  // Admin configuration
  const ADMIN_FILE = path.join(__dirname, "admins.json");
  let adminList = [];

  // Load or create admins file
  if (fs.existsSync(ADMIN_FILE)) {
    try {
      adminList = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf8"));
      console.log(`✅ Loaded ${adminList.length} admin(s)`);
    } catch (err) {
      console.error("❌ Error loading admins.json:", err);
      adminList = ["100071880593545"];
      fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminList, null, 2));
    }
  } else {
    adminList = ["100071880593545"];
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminList, null, 2));
    console.log("✅ Created admins.json with initial admin");
  }

  // Helper function to check if user is admin
  function isAdmin(userID) {
    return adminList.includes(userID);
  }

  // Helper function to add admin
  function addAdmin(userID) {
    if (!adminList.includes(userID)) {
      adminList.push(userID);
      fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminList, null, 2));
      return true;
    }
    return false;
  }

  // Helper function to remove admin
  function removeAdmin(userID) {
    const index = adminList.indexOf(userID);
    if (index > -1) {
      adminList.splice(index, 1);
      fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminList, null, 2));
      return true;
    }
    return false;
  }

  // Define commands
  const COMMANDS = {
    help: "Show all available commands and bot info",
    hello: "Say hello to the bot",
    uptime: "Show bot uptime",
    uid: "Get your user ID",
    ping: "Ping the bot",
    info: "Show admin information",
    pending: "Show pending group threads (Admin only)",
    admin: "Manage bot admins - admin list, admin add, admin remove (Admin only)",
    "restart bot": "Restart the bot (Admin only)"
  };

  // Language strings
  const languages = {
    en: {
      invaildNumber: "%1 𝙸𝚂 𝙽𝙾𝚃 𝙰 𝚅𝙰𝙻𝙸𝙳 𝙽𝚄𝙼𝙱𝙴𝚁",
      cantGetPendingList: "⚠️ 𝙲𝙰𝙽'𝚃 𝙶𝙴𝚃 𝚃𝙷𝙴 𝙿𝙴𝙽𝙳𝙸𝙽𝙶 𝙻𝙸𝚂𝚃!",
      returnListPending: "»「𝙿𝙴𝙽𝙳𝙸𝙽𝙶」«❮ 𝚃𝙾𝚃𝙰𝙻 𝚃𝙷𝚁𝙴𝙰𝙳𝚂 𝚃𝙾 𝙰𝙿𝙿𝚁𝙾𝚅𝙴: %1 ❯\n\n%2",
      returnListClean: "「𝙿𝙴𝙽𝙳𝙸𝙽𝙶」𝚃𝙷𝙴𝚁𝙴 𝙸𝚂 𝙽𝙾 𝚃𝙷𝚁𝙴𝙰𝙳 𝙸𝙽 𝚃𝙷𝙴 𝙻𝙸𝚂𝚃",
      adminOnly: "❌ 𝚃𝙷𝙸𝚂 𝙲𝙾𝙼𝙼𝙰𝙽𝙳 𝙸𝚂 𝙰𝚅𝙰𝙸𝙻𝙰𝙱𝙻𝙴 𝚃𝙾 𝙰𝙳𝙼𝙸𝙽 𝙾𝙽𝙻𝚈!"
    }
  };

  function _getText(key, ...args) {
    const text = languages.en[key] || key;
    return args.length
      ? text.replace("%1", args[0]).replace("%2", args[1] || "")
      : text;
  }

  // Quotes array for bot command
  const quotes = [
    "I love you 💝",
    "ভালোবাসি তোমাকে 🤖",
    "Hi, I'm massanger Bot i can help you.?🤖",
    "Use callad to contact admin!",
    "Hi, Don't disturb 🤖 🚘Now I'm going to Feni,Bangladesh..bye",
    "Hi, 🤖 i can help you~~~~",
    "আমি এখন আমিনুল বসের সাথে বিজি আছি",
    "আমাকে আমাকে না ডেকে আমার বসকে ডাকো এই নেও LINK :- https://www.facebook.com/100071880593545",
    "Hmmm sona 🖤 meye hoile kule aso ar sele hoile kule new 🫂😘",
    "Yah This Bot creator : PRINCE RID((A.R))   link => https://www.facebook.com/100071880593545",
    "হা বলো, শুনছি আমি 🤸‍♂️🫂",
    "Ato daktasen kn bujhlam na 😡",
    "jan bal falaba,🙂",
    "ask amr mon vlo nei dakben na🙂",
    "Hmm jan ummah😘😘",
    "jang hanga korba 🙂🖤",
    "iss ato dako keno lojja lage to 🫦🙈",
    "suna tomare amar valo lage,🙈😽"
  ];

  // Prefix list for quotes command
  const PREFIXES = ['bot', 'Bot'];

  // Get appstate
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
    process.exit(1);
  }

  // Cache directory
  const CACHE_DIR = path.join(__dirname, "cache");
  fs.ensureDirSync(CACHE_DIR);

  // Clean cache function
  function cleanCache() {
    fs.readdir(CACHE_DIR, (err, files) => {
      if (err) return console.error("❌ Cache cleanup error:", err);
      const now = Date.now();
      files.forEach(file => {
        const filePath = path.join(CACHE_DIR, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          if (now - stats.mtimeMs > 3600000) {
            fs.unlink(filePath).catch(console.error);
          }
        });
      });
    });
  }

  setInterval(cleanCache, 1800000);

  // ---------- FIXES START HERE ----------
  // MQTT listener variables
  let mqttListener = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const messageQueue = [];
  let processingQueue = false;

  // Process message queue to prevent overload
  async function processMessageQueue() {
    if (processingQueue || messageQueue.length === 0) return;
    
    processingQueue = true;
    
    while (messageQueue.length > 0) {
      const { event, api } = messageQueue.shift();
      try {
        await handleMessage(event, api);
      } catch (error) {
        console.error("❌ Error processing queued message:", error);
      }
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    processingQueue = false;
  }

  // Handle incoming messages
  async function handleMessage(event, api) {
    const { body, threadID, messageID, senderID } = event;
    
    if (!body) return;

    const lowerBody = body.toLowerCase();

    try {
      // Check for quotes command with prefix
      const startsWithPrefix = PREFIXES.some(prefix => body.startsWith(prefix));
      if (startsWithPrefix) {
        await sendQuoteMessage(senderID, threadID, messageID, api);
      } else {
        // Handle commands - VIDEO DOWNLOAD REMOVED
        switch (lowerBody) {
          case "hello":
            await api.sendMessage("hello i am aminul bot", threadID, messageID);
            break;
            
          case "help":
            await api.sendMessage(getHelpMessage(1), threadID, messageID);
            break;
            
          case "uptime":
            await api.sendMessage(`⏱ Bot Uptime: ${getUptime()}`, threadID, messageID);
            break;
            
          case "uid":
            await api.sendMessage(`👤 Your User ID: ${senderID}`, threadID, messageID);
            break;
            
          case "ping":
            await api.sendMessage("🏓 Pong! I'm online and working perfectly!", threadID, messageID);
            break;
            
          case "info":
            await sendInfoMessage(threadID, messageID, api);
            break;
            
          case "pending":
            if (!isAdmin(senderID)) {
              return api.sendMessage(_getText("adminOnly"), threadID, messageID);
            }
            await handlePendingCommand(threadID, messageID, api);
            break;
            
          case "restart bot":
            if (!isAdmin(senderID)) {
              return api.sendMessage(_getText("adminOnly"), threadID, messageID);
            }
            await api.sendMessage("🔄 Restarting bot...", threadID, messageID);
            setTimeout(() => process.exit(1), 1000);
            break;
            
          default:
            if (lowerBody.startsWith("help ")) {
              const pageMatch = lowerBody.match(/help\s+(\d+)/);
              const page = pageMatch ? parseInt(pageMatch[1]) : 1;
              await api.sendMessage(getHelpMessage(page), threadID, messageID);
            } 
            else if (lowerBody.startsWith("admin")) {
              if (!isAdmin(senderID)) {
                return api.sendMessage(_getText("adminOnly"), threadID, messageID);
              }
              const parts = lowerBody.split(" ");
              const subCommand = parts[1];
              const targetID = parts[2];

              if (subCommand === "list") {
                await handleAdminList(threadID, messageID, api);
              } else if (subCommand === "add" && targetID) {
                await handleAdminAdd(targetID, threadID, messageID, api);
              } else if (subCommand === "remove" && targetID) {
                await handleAdminRemove(targetID, threadID, messageID, api);
              } else {
                await api.sendMessage("❌ Usage: admin list | admin add <userID> | admin remove <userID>", threadID, messageID);
              }
            }
            // Removed URL detection and video download functionality
        }
      }
    } catch (error) {
      console.error("❌ Error handling message:", error);
      try {
        await api.sendMessage("❌ An error occurred processing your command.", threadID, messageID);
      } catch (e) {
        console.error("❌ Failed to send error message:", e);
      }
    }
  }

  // Handle group events
  function handleEvent(event, api) {
    const { threadID, logMessageType } = event;
    
    try {
      if (logMessageType === "log:subscribe") {
        api.sendMessage("👋 Welcome to the group! Use /help to see available commands.", threadID);
      } else if (logMessageType === "log:unsubscribe") {
        api.sendMessage("👋 A member has left the group.", threadID);
      }
    } catch (error) {
      console.error("❌ Error handling event:", error);
    }
  }

  // Setup MQTT listener with proper reconnection
  function setupMqttListener(api) {
    // Stop existing listener if any
    if (mqttListener) {
      try {
        mqttListener.stop();
      } catch (e) {
        console.log("⚠️ Could not stop existing listener:", e.message);
      }
    }

    console.log("🔄 Setting up MQTT listener...");
    
    mqttListener = api.listenMqtt((err, event) => {
      if (err) {
        console.error("❌ listenMqtt error:", err);
        
        // Exponential backoff for reconnection
        const delay = Math.min(10000 * Math.pow(2, reconnectAttempts), 60000);
        reconnectAttempts++;
        
        console.log(`⚠️ Reconnecting in ${delay/1000}s... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        
        setTimeout(() => {
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            setupMqttListener(api);
          } else {
            console.error("❌ Max reconnection attempts reached. Restarting worker...");
            process.exit(1);
          }
        }, delay);
        return;
      }

      // Reset reconnect attempts on successful connection
      reconnectAttempts = 0;

      if (!event) return;

      // Handle different event types
      if (event.type === "message" || event.type === "message_reply") {
        messageQueue.push({ event, api });
        processMessageQueue();
      } else if (event.type === "event") {
        handleEvent(event, api);
      }
    });

    // Add error handler for the listener itself
    if (mqttListener && mqttListener.on) {
      mqttListener.on('error', (error) => {
        console.error("❌ MQTT Listener error:", error);
      });
    }
  }

  // Keep-alive mechanism
  function startKeepAlive(api) {
    setInterval(() => {
      if (api && api.getCurrentUserID) {
        api.getCurrentUserID((err, userID) => {
          if (err) {
            console.error("❌ Keep-alive failed:", err);
          } else {
            console.log("💓 Keep-alive ping successful");
          }
        });
      }
    }, 300000); // Every 5 minutes
  }

  // ---------- END OF FIXES ----------

  // Bot login
  login(
    { appState: appState },
    (err, api) => {
      if (err) {
        console.error("❌ Login error:", err);
        process.exit(1);
      }

      console.log("✅ Bot Login Success!");
      console.log(`🤖 Bot is now listening for messages...`);

      // Health report task (Every 1 hour)
      setInterval(() => {
        const report = `⏱️ **𝗛𝗘𝗔𝗟𝗧𝗛 𝗥𝗘𝗣𝗢𝗥𝗧** ⏱️\n\n` +
          `✅ **Status:** Online & Healthy\n` +
          `⏱️ **Uptime:** ${getUptime()}\n` +
          `🆔 **PID:** ${process.pid}\n` +
          `📅 **Timestamp:** ${new Date().toLocaleString()}\n\n` +
          `🤖 *Automated System Report*`;
        
        adminList.forEach(adminID => {
          api.sendMessage(report, adminID);
        });
        console.log("📢 Health report sent to admins");
      }, 3600000); // 1 hour in milliseconds

      // Start MQTT listener with fixes
      setupMqttListener(api);
      
      // Start keep-alive
      startKeepAlive(api);

      // Graceful shutdown handling
      process.on('SIGTERM', () => {
        console.log('📴 Worker shutting down gracefully...');
        if (mqttListener && mqttListener.stop) {
          mqttListener.stop();
        }
        setTimeout(() => process.exit(0), 1000);
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

  function getHelpMessage(page = 1) {
    const numberOfOnePage = 5;
    let arrayInfo = [];

    let msg = `😊!!-> 𝗔𝗦𝗦𝗔𝗟𝗔-𝗠𝗨𝗔𝗟𝗔𝗜𝗞𝗨𝗠 <-!!🥰\n⚘⊶───────────────────⚭\n˚ · .˚ · . ❀ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗟𝗜𝗦𝗧 ❀ ˚ · .˚ · .\n\n┌────────────────────❍\n`;

    // Build array of commands with descriptions
    for (const [name, value] of Object.entries(COMMANDS)) {
      const cmdName = `${name}  𓆩😇𓆪  ${value}`;
      arrayInfo.push(cmdName);
    }

    // Sort array
    arrayInfo.sort((a, b) => a.localeCompare(b));

    // Pagination logic
    const startSlice = numberOfOnePage * page - numberOfOnePage;
    let i = startSlice;
    const returnArray = arrayInfo.slice(startSlice, startSlice + numberOfOnePage);

    // Build message with commands
    for (let item of returnArray) {
      msg += `├⊶〘 ${++i} 〙- ${item}\n`;
    }

    // Add footer
    const totalPages = Math.ceil(arrayInfo.length / numberOfOnePage);
    msg += `└────────────────────❍\n⚘⊶───────────────────⚭
😫!!-> 𝐀𝐌𝐈𝐍𝐔𝐋 𝐒𝐎𝐑𝐃𝐀𝐑 <-!!🥵
😀!!-> 𝗕𝗢𝗧𓆩😇𓆪𝗔𝗠𝗜𝗡𝗨𝗟 𝟭𝟰𝟯 <-!!😘
                                ┌──❀*̥˚───❀*̥˚─┐
                                                         𝗣𝗔𝗚𝗘 ${page}/${totalPages}
                                └───❀*̥˚───❀*̥˚┘

𝗧𝗢𝗧𝗔𝗟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗢𝗡 𝗕𝗢𝗧 - ${arrayInfo.length}

𝗔𝗡𝗬 𝗛𝗘𝗟𝗣 𝗖𝗢𝗡𝗧𝗔𝗖𝗧 𝗠𝗬 𝗔𝗗𝗠𝗜𝗡
𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗜𝗗 : 𝐀𝐌𝐈𝐍𝐔𝐋 𝐒𝐎𝐑𝐃𝐀𝐑 😗`;

    return msg;
  }

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

  // Handle pending command
  async function handlePendingCommand(threadID, messageID, api) {
    try {
      let pendingList = [];

      try {
        const other = await api.getThreadList(100, null, ["OTHER"]);
        const pending = await api.getThreadList(100, null, ["PENDING"]);
        pendingList = [...other, ...pending].filter(g => g.isGroup && g.isSubscribed);
      } catch (err) {
        console.error("❌ Error getting thread list:", err);
        return api.sendMessage(_getText("cantGetPendingList"), threadID, messageID);
      }

      if (!pendingList.length) {
        return api.sendMessage(_getText("returnListClean"), threadID, messageID);
      }

      let msg = "";
      pendingList.forEach((g, i) => {
        msg += `${i + 1}/ ${g.name} (${g.threadID})\n`;
      });

      return api.sendMessage(
        _getText("returnListPending", pendingList.length, msg),
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ Error in handlePendingCommand:", error);
      api.sendMessage(_getText("cantGetPendingList"), threadID, messageID);
    }
  }

  // Handle admin list command
  function handleAdminList(threadID, messageID, api) {
    try {
      let msg = "👮 𝗔𝗖𝗧𝗜𝗩𝗘 𝗔𝗗𝗠𝗜𝗡𝗦:\n\n";
      adminList.forEach((id, index) => {
        msg += `${index + 1}. ${id}\n`;
      });
      api.sendMessage(msg, threadID, messageID);
    } catch (error) {
      console.error("❌ Error in handleAdminList:", error);
      api.sendMessage("❌ Error retrieving admin list", threadID, messageID);
    }
  }

  // Handle admin add command
  function handleAdminAdd(userID, threadID, messageID, api) {
    try {
      if (!userID || userID === "") {
        return api.sendMessage("❌ Please provide a valid user ID", threadID, messageID);
      }
      if (addAdmin(userID)) {
        api.sendMessage(`✅ User ${userID} has been added as admin!`, threadID, messageID);
      } else {
        api.sendMessage(`⚠️ User ${userID} is already an admin!`, threadID, messageID);
      }
    } catch (error) {
      console.error("❌ Error in handleAdminAdd:", error);
      api.sendMessage("❌ Error adding admin", threadID, messageID);
    }
  }

  // Handle admin remove command
  function handleAdminRemove(userID, threadID, messageID, api) {
    try {
      if (!userID || userID === "") {
        return api.sendMessage("❌ Please provide a valid user ID", threadID, messageID);
      }
      if (removeAdmin(userID)) {
        api.sendMessage(`✅ User ${userID} has been removed from admins!`, threadID, messageID);
      } else {
        api.sendMessage(`⚠️ User ${userID} is not an admin!`, threadID, messageID);
      }
    } catch (error) {
      console.error("❌ Error in handleAdminRemove:", error);
      api.sendMessage("❌ Error removing admin", threadID, messageID);
    }
  }

  // Send random quote message with mention
  function sendQuoteMessage(senderID, threadID, messageID, api) {
    return new Promise((resolve, reject) => {
      try {
        // Get random quote
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        // Get user info for mention
        api.getUserInfo(senderID, (err, userInfo) => {
          if (err) {
            console.error("❌ Error getting user info:", err);
            api.sendMessage(randomQuote, threadID, messageID);
            return resolve();
          }

          const user = userInfo[senderID];
          if (!user) {
            api.sendMessage(randomQuote, threadID, messageID);
            return resolve();
          }

          const userName = user.name || user.firstName || "Friend";

          // Send message with mention
          api.sendMessage({
            body: `🥀 ${userName} 🥀\n\n${randomQuote}`,
            mentions: [{ id: senderID, tag: userName }]
          }, threadID, messageID, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (error) {
        console.error("❌ Error in sendQuoteMessage:", error);
        api.sendMessage("❌ An error occurred", threadID, messageID);
        reject(error);
      }
    });
  }

  // Video download function completely removed
}
