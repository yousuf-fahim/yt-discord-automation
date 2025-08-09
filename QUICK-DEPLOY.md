# Quick Deployment Guide

This guide provides quick deployment instructions for the YouTube to Discord bot.

## Option 1: Heroku Deployment (Using Credits)

1. **Install Heroku CLI and login**:
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Create a Heroku app**:
   ```bash
   heroku create yt-discord-bot
   ```

3. **Set environment variables**:
   ```bash
   heroku config:set DISCORD_BOT_TOKEN=your_token_here
   heroku config:set DISCORD_GUILD_ID=your_guild_id_here
   heroku config:set DISCORD_YT_SUMMARIES_CHANNEL=yt-uploads
   heroku config:set OPENAI_API_KEY=your_openai_key_here
   # Optional: YouTube API key for better title fetching
   heroku config:set YOUTUBE_API_KEY=your_youtube_api_key_here
   ```

4. **Add buildpacks**:
   ```bash
   heroku buildpacks:add --index 1 https://github.com/jontewks/puppeteer-heroku-buildpack
   heroku buildpacks:add --index 2 heroku/nodejs
   heroku buildpacks:add --index 3 https://github.com/heroku/heroku-buildpack-apt
   ```

5. **Deploy to Heroku**:
   ```bash
   git push heroku main
   ```

6. **Scale the worker dyno**:
   ```bash
   heroku ps:scale worker=1
   ```

7. **Add Scheduler for daily reports**:
   ```bash
   heroku addons:create scheduler:standard
   ```
   
   Then in the Heroku dashboard, add a job to run daily at 18:00 UTC:
   ```
   node api/manual-trigger.js daily-report
   ```

## Option 2: Oracle Cloud Free Tier (Always Free)

1. **Sign up for Oracle Cloud Free Tier**:
   - Go to [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
   - Create an account and sign in

2. **Create a VM instance**:
   - Choose "Always Free" eligible ARM-based VM
   - Use Oracle Linux or Ubuntu
   - Configure SSH access

3. **Connect to your VM**:
   ```bash
   ssh username@your-vm-ip
   ```

4. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/ytDiscord.git
   cd ytDiscord
   ```

5. **Run the setup script**:
   ```bash
   chmod +x setup-oracle-cloud.sh
   sudo ./setup-oracle-cloud.sh
   ```

6. **Create .env file**:
   ```bash
   nano .env
   ```
   
   Add the following content:
   ```
   DISCORD_BOT_TOKEN=your_token_here
   DISCORD_GUILD_ID=your_guild_id_here
   DISCORD_YT_SUMMARIES_CHANNEL=yt-uploads
   OPENAI_API_KEY=your_openai_key_here
   YOUTUBE_API_KEY=your_youtube_api_key_here
   ```

7. **Enable and start the service**:
   ```bash
   sudo systemctl enable discord-bot
   sudo systemctl start discord-bot
   ```

8. **Set up cron job for daily reports**:
   ```bash
   crontab -e
   ```
   
   Add the following line:
   ```
   0 18 * * * cd /path/to/ytDiscord && /usr/bin/node api/manual-trigger.js daily-report
   ```

## Monitoring and Management

### Check bot status:
```bash
# Heroku
heroku logs --tail

# Oracle Cloud
sudo systemctl status discord-bot
journalctl -u discord-bot
```

### Manage cache:
```bash
# View cache statistics
node api/manage-cache.js stats

# Clean cache manually
node api/manage-cache.js clean
```

### Manually trigger operations:
```bash
# Generate summary for a specific video
node api/manual-trigger.js summary <videoId>

# Generate daily report
node api/manual-trigger.js report
```

## Troubleshooting

If the bot isn't working properly:

1. **Check logs** for errors
2. **Verify environment variables** are set correctly
3. **Check Discord permissions** for the bot
4. **Verify the bot is in the correct server** and has access to the channels
5. **Test transcript extraction** with `node test-transcript.js`

For more detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).
For troubleshooting help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
