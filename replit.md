# Aminul Facebook Messenger Bot

A Facebook Messenger bot built with Node.js for group management and various utility commands.

## Features

- **Cluster-based Architecture**: Auto-restart on crashes for high availability
- **Admin Management System**: Add/remove administrators with persistent storage
- **Command Handler**: Extensible command system with permission levels
- **MQTT Listener**: Robust message listening with exponential backoff reconnection
- **Health Monitoring**: Automated health reports to admins

## Commands

### Public Commands
- `hello` - Say hello to the bot
- `help [page]` - Show all available commands (paginated)
- `uid` - Get your user ID
- `ping` - Check if bot is online
- `uptime` - Show bot uptime with random anime image
- `info` - Show admin information
- `listbox` - List all groups the bot is in
- `weather <city>` - Get weather information for a city
- Bot prefix commands (`bot` or `Bot`): Get random quotes with mention

### Admin Commands
- `pending` - Show pending group threads (Admin only)
- `admin list` - List all admins
- `admin add <userID>` - Add admin
- `admin remove <userID>` - Remove admin
- `sendnoti <message>` - Send notification to all groups (Admin only)
- `restart bot` - Restart the bot (Admin only)

## Project Structure

```
.
├── index.js           # Main bot file with cluster management
├── package.json       # Dependencies
├── admins.json        # Admin user IDs (auto-created)
├── appstate.json      # Facebook session (or via APPSTATE_JSON env var)
└── cache/             # Temporary files (auto-created)
```

## Environment Variables

- `PORT` - Web server port (default: 3000)
- `APPSTATE_JSON` - Facebook session as JSON string (alternative to appstate.json file)

## Endpoints

- `GET /` - Bot status page
- `GET /health` - Health check endpoint (JSON)

## New Commands Added (v2)

### listbox
Lists all groups the bot is in with group names and IDs.

### weather
Fetches current weather for a specified city using Open-Meteo API (free, no key needed).
Usage: `weather <city>`

### sendnoti  
Sends a notification message to all groups (admin only). Includes success/failure count.
Usage: `sendnoti <message>`
Note: Only admins can use this command.

## Development Notes

- Uses `aminul-new-fca` for Facebook Messenger API
- Message queue prevents bot overload
- Automatic cache cleanup every 30 minutes
- Health reports sent to admins hourly
