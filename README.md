Aminul Bot – Facebook Messenger Bot

A powerful, self‑hosted Facebook Messenger bot built with aminul-new-fca (a fork of fca-unofficial). It includes an auto‑restart master process, a web dashboard, admin management, video downloading, and many fun commands.

---

✨ Features

· Auto‑restart – Master process restarts workers if they crash (cluster mode).
· Web Dashboard – Express server shows bot status, uptime, and health checks.
· Admin System – Manage bot admins via commands (admin list, admin add, admin remove).
· Pending Threads – View groups waiting for approval (pending command, admin only).
· Video Downloader – Automatically download videos from links (supports many platforms via API).
· Random Quotes – Bot replies with a random quote when you type a prefix (bot or Bot).
· Basic Commands – help, hello, uptime, uid, ping, info.
· Health Reports – Hourly uptime reports sent to all admins.
· Automatic User‑Agent Patching – Ensures all outgoing HTTP requests include a proper User‑Agent header.
· Cache Cleanup – Automatically removes old downloaded files every 30 minutes.
· Graceful Shutdown – Handles SIGINT to stop workers cleanly.

---

📋 Prerequisites

· Node.js (v14 or newer recommended)
· A Facebook account (used to obtain an appstate)
· A hosting environment (e.g. Heroku, Railway, VPS, or your own PC)

---

🔧 Installation

1. Clone the repository (or create a new directory and copy the code into index.js):
   ```bash
   git clone https://github.com/yourusername/aminul-bot.git
   cd aminul-bot
   ```
2. Install dependencies:
   ```bash
   npm install aminul-new-fca fs-extra axios request express
   ```
3. Obtain Facebook appstate
      Use a tool like c3c-fbstate to get your appstate.json file and place it in the project root.
      Alternatively, you can set the APPSTATE_JSON environment variable with the JSON string (see Configuration below).
4. Create an admins.json file (optional)
      The bot will create one automatically with a default admin ID (100071880593545). You can edit it later.

---

⚙️ Configuration

Environment Variables

Variable Description
PORT Port for the web server (default: 3000)
APPSTATE_JSON Alternative to appstate.json – the entire appstate object as a JSON string.

Files

· appstate.json – Facebook login credentials (if not using APPSTATE_JSON).
· admins.json – Array of admin Facebook user IDs. The bot loads this file at startup.

Admin Default

The default admin ID is 100071880593545. You can change it by editing admins.json or using the admin commands after the bot is running.

---

🚀 Running the Bot

Start the bot with:

```bash
node index.js
```

You will see:

· Master process starts and forks a worker.
· Worker logs in and begins listening for messages.
· Web server starts on the specified port.

Using environment variables (e.g. on Heroku):

```bash
export PORT=8080
export APPSTATE_JSON='[{"key":"...","value":"...","domain":".facebook.com"}]'
node index.js
```

---

📱 Bot Commands

All commands are triggered by typing the command in any chat where the bot is present.

Command Description
help Show paginated list of all commands.
help <page> Show a specific page (e.g. help 2).
hello Bot replies with "hello i am aminul bot".
uptime Show how long the bot has been running.
uid Get your Facebook user ID.
ping Check if the bot is online.
info Show admin information and contact details.
pending (Admin only) List groups pending approval.
admin list (Admin only) Show all admin IDs.
admin add <userID> (Admin only) Add a new admin.
admin remove <userID> (Admin only) Remove an admin.
bot or Bot Reply with a random quote and mention the sender.
Any video URL Automatically download the video and send it back.

---

🛡️ Admin System

· The bot uses admins.json to store admin IDs.
· The first admin is set by default; you can change it manually in the file.
· All admin commands require the sender to be in the admin list.
· Admin list can be managed dynamically via admin add and admin remove.

---

🌐 Web Server & Health Checks

The bot starts an Express server on the configured port (default 3000).

· / – Simple HTML dashboard showing bot status, uptime, command count, and PID.
· /health – JSON endpoint with status, uptime, pid, and timestamp.

These endpoints can be used for monitoring services (like Uptime Robot).

---

🔄 Auto‑Restart Mechanism (Master/Worker)

The script uses Node.js cluster module:

· Master process – Starts one worker. If the worker dies, it forks a new one immediately.
· Worker process – Runs the actual bot logic. Handles uncaught exceptions and unhandled rejections by exiting after logging, so the master can restart it.
· Graceful shutdown – Pressing Ctrl+C in the master kills the worker and exits cleanly.

This ensures the bot stays online even after temporary errors.

---

🧹 Cache Cleanup

Downloaded videos are stored in the cache/ directory.
Every 30 minutes, files older than 1 hour are automatically deleted to prevent disk space issues.

---

⚠️ Troubleshooting

"Port is already in use"

If the web server fails to start because the port is occupied, the bot attempts to kill the process using that port (Linux/macOS only). If it fails, you need to free the port manually.

Login errors

· Make sure your appstate.json is valid and not expired.
· If using APPSTATE_JSON, ensure the JSON string is correctly formatted (no extra quotes or line breaks).

Worker crashes frequently

Check the console for uncaughtException or unhandledRejection logs. They usually indicate issues with the Facebook API or your network. The master will restart the worker automatically.

Bot not responding

· Verify the bot is online (visit the web dashboard).
· Check that the Facebook account used for the bot is still logged in (appstate may have expired).
· Look for error messages in the logs.

---

📄 License

This project is open source and available under the MIT License.

---

🙏 Credits

· Author: Aminul Sardar
· Facebook: facebook.com/100071880593545
· Library: aminul-new-fca (modified version of fca-unofficial)

---

Happy messaging! 🤖
