# Render Deployment Guide

Your Facebook Messenger Bot is now configured for deployment on Render.

## Setup Instructions

### 1. Push to GitHub
```bash
git push origin main
```

### 2. Create Render Service
1. Go to [Render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Fill in the deployment settings:
   - **Name**: `aminulbot` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Plan**: Select your preferred plan (Free tier available)

### 3. Add Environment Variables
In Render's environment variables section, add:
- **APPSTATE_JSON**: Your Facebook account credentials (JSON format)
  - Get this from your `appstate.json` file (convert to single-line JSON)
  - This is the account your bot will use to send/receive messages

- **PORT**: `3000` (already configured in code)

### 4. Deploy
Click "Create Web Service" and Render will automatically deploy your bot!

## Account Information
Your bot account on Render will be:
- **Bot Name**: Goats Replit
- **Bot User ID**: 61586245691233

## Important Security Notes

✅ **Never commit sensitive files to GitHub:**
- `appstate.json` - Contains Facebook session cookies (in .gitignore)
- `fb_dtsg_data.json` - Contains temporary tokens (in .gitignore)

✅ **Store credentials as environment variables:**
- Set `APPSTATE_JSON` as a secret in Render
- The bot will automatically use this for authentication

## Troubleshooting

**Bot won't start on Render?**
- Check that `APPSTATE_JSON` is set correctly
- Verify the environment variable contains valid JSON
- Check Render logs for authentication errors

**Need to update credentials?**
- Update the `APPSTATE_JSON` environment variable in Render
- Render will automatically restart the bot

## Local Development
To run locally:
```bash
npm install
node index.js
```
The bot will use `appstate.json` file if `APPSTATE_JSON` env var is not set.
