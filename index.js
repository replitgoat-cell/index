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
  // WORKER PROCESS (fixed bot)
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

  // Set process title
  process.title = `aminul-bot-worker-${process.pid}`;

  // ----- User-Agent patches -----
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

  // ----- Dependencies -----
  const login = require("aminul-new-fca");
  const fs = require("fs-extra");
  const path = require("path");
  const axios = require("axios");
  const request = require("request");

  // ----- Configuration -----
  const PORT = process.env.PORT || 3000;
  const APPSTATE_JSON = process.env.APPSTATE_JSON;
  const BOT_START_TIME = Date.now();

  // ----- Express Server (for health checks) -----
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
            <p>🆔 Process ID: ${process.pid}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      uptime: getUptime(),
      pid: process.pid,
      timestamp: new Date().toISOString()
    });
  });

  // Start web server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use!`);
      console.log('🔄 Trying to free the port...');
      const { exec } = require('child_process');
      exec(`lsof -ti:${PORT} | xargs kill -9`, (err) => {
        if (err) {
          console.error('❌ Could not free port. Exiting.');
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

  // ----- Admin Configuration -----
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

  // Admin helper functions
  function isAdmin(userID) {
    return adminList.includes(userID);
  }

  function addAdmin(userID) {
    if (!adminList.includes(userID)) {
      adminList.push(userID);
      fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminList, null, 2));
      return true;
    }
    return false;
  }

  function removeAdmin(userID) {
    const index = adminList.indexOf(userID);
    if (index > -1) {
      adminList.splice(index, 1);
      fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminList, null, 2));
      return true;
    }
    return false;
  }

  // ----- Commands List -----
  const COMMANDS = {
    help: "Show all available commands",
    hello: "Say hello to the bot",
    uptime: "Show bot uptime",
    uid: "Get your user ID",
    ping: "Ping the bot",
    info: "Show admin information",
    pending: "Show pending group threads (Admin only)",
    admin: "Manage bot admins (Admin only)",
    "restart": "Restart the bot (Admin only)",
    "bot": "Get a random quote (any message starting with 'bot')"
  };

  // Language strings
  const languages = {
    en: {
      invaildNumber: "%1 IS NOT A VALID NUMBER",
      cantGetPendingList: "⚠️ CAN'T GET THE PENDING LIST!",
      returnListPending: "»「PENDING」«❮ TOTAL THREADS TO APPROVE: %1 ❯\n\n%2",
      returnListClean: "「PENDING」THERE IS NO THREAD IN THE LIST",
      adminOnly: "❌ THIS COMMAND IS FOR ADMINS ONLY!"
    }
  };

  function _getText(key, ...args) {
    const text = languages.en[key] || key;
    return args.length
      ? text.replace("%1", args[0]).replace("%2", args[1] || "")
      : text;
  }

  // Quotes array
  const quotes = [
    "I love you 💝",
    "ভালোবাসি তোমাকে 🤖",
    "Hi, I'm messenger Bot i can help you.?🤖",
    "Use callad to contact admin!",
    "Hi, Don't disturb 🤖 🚘Now I'm going to Feni,Bangladesh..bye",
    "Hi, 🤖 i can help you~~~~",
    "আমি এখন আমিনুল বসের সাথে বিজি আছি",
    "আমাকে না ডেকে আমার বসকে ডাকো LINK :- https://www.facebook.com/100071880593545",
    "Hmmm sona 🖤",
    "Yah This Bot creator : PRINCE RID((A.R)) link => https://www.facebook.com/100071880593545",
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
  const PREFIXES = ['bot', 'Bot', 'বট'];

  // ----- AppState Loading -----
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

  // ----- Cache Directory -----
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

  // ============== FIXED MESSAGE HANDLER ==============
  
  // Variables for MQTT
  let mqttListener = null;
  let reconnectAttempts = 0;

  // Handle incoming messages - IMPROVED VERSION
  async function handleMessage(event, api) {
    const { body, threadID, messageID, senderID } = event;
    
    if (!body) return;

    // Normalize message
    const originalMessage = body;
    const lowercaseMessage = body.trim().toLowerCase();
    const words = lowercaseMessage.split(' ');

    console.log(`📨 New message: "${originalMessage}" from ${senderID} in thread ${threadID}`);

    try {
      // ----- CHECK FOR QUOTES COMMAND (any message containing 'bot') -----
      if (lowercaseMessage.includes('bot') || 
          lowercaseMessage.includes('বট') || 
          words.some(word => PREFIXES.includes(word))) {
        
        console.log('💬 Quotes command detected!');
        await sendQuoteMessage(senderID, threadID, messageID, api);
        return;
      }

      // ----- REGULAR COMMANDS -----
      
      // Help command
      if (lowercaseMessage === 'help' || lowercaseMessage === 'help ') {
        await api.sendMessage(getHelpMessage(1), threadID, messageID);
      }
      // Help with page number
      else if (lowercaseMessage.startsWith('help ')) {
        const pageMatch = lowercaseMessage.match(/help\s+(\d+)/);
        const page = pageMatch ? parseInt(pageMatch[1]) : 1;
        await api.sendMessage(getHelpMessage(page), threadID, messageID);
      }
      // Hello command
      else if (lowercaseMessage === 'hello' || lowercaseMessage === 'হ্যালো' || lowercaseMessage === 'হাই') {
        await api.sendMessage("Hello! I am Aminul Bot. How can I help you?", threadID, messageID);
      }
      // Uptime command
      else if (lowercaseMessage === 'uptime' || lowercaseMessage === 'আপটাইম') {
        await api.sendMessage(`⏱ Bot Uptime: ${getUptime()}`, threadID, messageID);
      }
      // UID command
      else if (lowercaseMessage === 'uid' || lowercaseMessage === 'আইডি' || lowercaseMessage === 'ইউআইডি') {
        await api.sendMessage(`👤 Your User ID: ${senderID}`, threadID, messageID);
      }
      // Ping command
      else if (lowercaseMessage === 'ping' || lowercaseMessage === 'পিং') {
        await api.sendMessage("🏓 Pong! Bot is online and working!", threadID, messageID);
      }
      // Info command
      else if (lowercaseMessage === 'info' || lowercaseMessage === 'তথ্য' || lowercaseMessage === 'ইনফো') {
        await sendInfoMessage(threadID, messageID, api);
      }
      // Pending command (admin only)
      else if (lowercaseMessage === 'pending' || lowercaseMessage === 'পেন্ডিং') {
        if (!isAdmin(senderID)) {
          return api.sendMessage("❌ This command is for admins only!", threadID, messageID);
        }
        await handlePendingCommand(threadID, messageID, api);
      }
      // Restart command (admin only)
      else if (lowercaseMessage === 'restart' || lowercaseMessage === 'রিস্টার্ট') {
        if (!isAdmin(senderID)) {
          return api.sendMessage("❌ This command is for admins only!", threadID, messageID);
        }
        await api.sendMessage("🔄 Restarting bot...", threadID, messageID);
        setTimeout(() => process.exit(1), 1000);
      }
      // Admin commands
      else if (lowercaseMessage.startsWith('admin')) {
        if (!isAdmin(senderID)) {
          return api.sendMessage("❌ This command is for admins only!", threadID, messageID);
        }
        
        const parts = lowercaseMessage.split(' ');
        
        if (parts.length === 1 || parts[1] === 'list') {
          await handleAdminList(threadID, messageID, api);
        }
        else if (parts[1] === 'add' && parts[2]) {
          await handleAdminAdd(parts[2], threadID, messageID, api);
        }
        else if (parts[1] === 'remove' && parts[2]) {
          await handleAdminRemove(parts[2], threadID, messageID, api);
        }
        else {
          await api.sendMessage(
            "❌ Admin Commands:\n" +
            "• admin list - Show all admins\n" +
            "• admin add <userID> - Add new admin\n" +
            "• admin remove <userID> - Remove admin",
            threadID, 
            messageID
          );
        }
      }
      // Test command (for debugging)
      else if (lowercaseMessage === 'test' || lowercaseMessage === 'টেস্ট') {
        await api.sendMessage(
          `✅ Bot is working!\n\n` +
          `Your message: ${originalMessage}\n` +
          `Thread ID: ${threadID}\n` +
          `Sender ID: ${senderID}`,
          threadID, 
          messageID
        );
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
        api.sendMessage("👋 Welcome to the group! Send 'help' to see available commands.", threadID);
      } else if (logMessageType === "log:unsubscribe") {
        api.sendMessage("👋 A member has left the group.", threadID);
      }
    } catch (error) {
      console.error("❌ Error handling event:", error);
    }
  }

  // ============== FIXED MQTT LISTENER ==============
  
  function setupMqttListener(api) {
    console.log("🔄 Setting up MQTT listener...");
    
    // Stop existing listener if any
    if (mqttListener) {
      try {
        if (typeof mqttListener.stop === 'function') {
          mqttListener.stop();
        }
      } catch (e) {
        console.log("⚠️ Could not stop existing listener:", e.message);
      }
    }

    // Set up new listener
    try {
      mqttListener = api.listenMqtt((err, event) => {
        if (err) {
          console.error("❌ MQTT Error:", err);
          
          // Reconnection logic
          reconnectAttempts++;
          const delay = Math.min(5000 * reconnectAttempts, 30000);
          
          console.log(`⚠️ Reconnecting in ${delay/1000} seconds... (Attempt ${reconnectAttempts})`);
          
          setTimeout(() => {
            if (reconnectAttempts < 10) {
              setupMqttListener(api);
            } else {
              console.error("❌ Max reconnection attempts reached. Restarting...");
              process.exit(1);
            }
          }, delay);
          return;
        }

        // Reset reconnect attempts on success
        reconnectAttempts = 0;

        // Process events
        if (event) {
          console.log(`📡 Event received: ${event.type || 'unknown'}`);
          
          if (event.type === "message" || event.type === "message_reply") {
            // Handle message directly
            handleMessage(event, api).catch(e => {
              console.error("❌ Error in message handler:", e);
            });
          } 
          else if (event.type === "event") {
            handleEvent(event, api);
          }
        }
      });

      console.log("✅ MQTT listener is active and listening for messages!");
      
      // Add error handler for the listener
      if (mqttListener && mqttListener.on) {
        mqttListener.on('error', (error) => {
          console.error("❌ MQTT Listener error:", error);
        });
      }

    } catch (error) {
      console.error("❌ Failed to setup MQTT listener:", error);
      setTimeout(() => setupMqttListener(api), 5000);
    }
  }

  // ============== BOT LOGIN ==============
  
  login(
    { appState: appState },
    (err, api) => {
      if (err) {
        console.error("❌ Login error:", err);
        process.exit(1);
      }

      console.log("✅ Bot Login Successful!");
      api.getCurrentUserID((err, userID) => {
        if (!err) {
          console.log(`🤖 Bot User ID: ${userID}`);
        }
      });
      console.log(`🤖 Bot is now listening for messages...`);

      // Start MQTT listener after a short delay
      setTimeout(() => {
        setupMqttListener(api);
      }, 2000);

      // Keep-alive mechanism (every 2 minutes)
      setInterval(() => {
        api.getUserInfo(api.getCurrentUserID(), (err, userInfo) => {
          if (err) {
            console.error("❌ Keep-alive failed:", err);
          } else {
            console.log("💓 Keep-alive: Bot is online");
          }
        });
      }, 120000);

      // Health report to admins (every hour)
      setInterval(() => {
        const report = `⏱️ **HEALTH REPORT** ⏱️\n\n` +
          `✅ **Status:** Online & Healthy\n` +
          `⏱️ **Uptime:** ${getUptime()}\n` +
          `🆔 **PID:** ${process.pid}\n` +
          `📅 **Timestamp:** ${new Date().toLocaleString()}\n\n` +
          `🤖 *Automated System Report*`;
        
        adminList.forEach(adminID => {
          api.sendMessage(report, adminID).catch(console.error);
        });
        console.log("📢 Health report sent to admins");
      }, 3600000);

      // Graceful shutdown
      process.on('SIGTERM', () => {
        console.log('📴 Worker shutting down gracefully...');
        if (mqttListener && typeof mqttListener.stop === 'function') {
          mqttListener.stop();
        }
        setTimeout(() => process.exit(0), 1000);
      });
    }
  );

  // ============== HELPER FUNCTIONS ==============

  // Get uptime string
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

  // Get help message with pagination
  function getHelpMessage(page = 1) {
    const numberOfOnePage = 5;
    let arrayInfo = [];

    let msg = `😊!!-> ASSALAMUALAIKUM <-!!🥰\n⚘⊶───────────────────⚭\n˚ · .˚ · . ❀ COMMAND LIST ❀ ˚ · .˚ · .\n\n┌────────────────────❍\n`;

    // Build array of commands with descriptions
    for (const [name, value] of Object.entries(COMMANDS)) {
      const cmdName = `${name} 𓆩😇𓆪 ${value}`;
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
    msg += `└────────────────────❍\n⚘⊶───────────────────⚭\n😫!!-> AMINUL SORDAR <-!!🥵\n😀!!-> BOT𓆩😇𓆪AMINUL 143 <-!!😘\n                                ┌──❀*̥˚───❀*̥˚─┐\n                                                         PAGE ${page}/${totalPages}\n                                └───❀*̥˚───❀*̥˚┘\n\nTOTAL COMMANDS - ${arrayInfo.length}\n\nANY HELP CONTACT MY ADMIN\nFACEBOOK ID : AMINUL SORDAR 😗`;

    return msg;
  }

  // Send info message with admin photo
  function sendInfoMessage(threadID, messageID, api) {
    const avatarURL = "https://graph.facebook.com/100071880593545/picture?height=720&width=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";
    const imgPath = path.join(CACHE_DIR, "aminul-avatar.png");

    const callback = () => {
      api.sendMessage({
        body: `╭─〔🌸 AMINUL BOT INFO 🌸〕─╮
│ 💫 **Name:** Aminul Sardar
│ 🕌 **Religion:** Islam
│ 📍 **From:** Rajshahi, Dhaka
│ 👦 **Gender:** Male
│ 🎂 **Age:** 18+
│ 💞 **Relationship:** Single
│ 🎓 **Work:** Student
│ ✉ **Gmail:** aminulsordar04@gmail.com
│ 💬 **WhatsApp:** wa.me/+8801704407109
│ 💭 **Telegram:** t.me/Aminulsordar
│ 🌐 **Facebook:** facebook.com/100071880593545
│
╰───〔💛 AMINUL X BOT 💛〕───╯`,
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
      let msg = "👮 ACTIVE ADMINS:\n\n";
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
            mentions: [{ tag: userName, id: senderID }]
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
}
