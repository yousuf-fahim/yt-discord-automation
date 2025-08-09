#!/bin/bash
# Setup script for Oracle Cloud Free Tier VM
# Run as root or with sudo

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install git and other dependencies
apt install -y git python3 python3-pip ffmpeg

# Install yt-dlp
pip3 install yt-dlp

# Create a service user (optional)
# useradd -m -s /bin/bash discord-bot

# Clone the repository (replace with your repo URL)
# git clone https://github.com/yourusername/ytDiscord.git /home/discord-bot/ytDiscord
# cd /home/discord-bot/ytDiscord

# Install dependencies
# npm install

# Copy systemd service file
cp discord-bot.service /etc/systemd/system/

# Set proper permissions
# chown -R discord-bot:discord-bot /home/discord-bot/ytDiscord

# Reload systemd
systemctl daemon-reload

echo "Setup complete! Now you need to:"
echo "1. Create .env file with your environment variables"
echo "2. Enable and start the service with:"
echo "   systemctl enable discord-bot"
echo "   systemctl start discord-bot"
echo "3. Add crontab entry for daily reports:"
echo "   0 18 * * * cd /path/to/ytDiscord && /usr/bin/node api/manual-trigger.js daily-report"
echo ""
echo "Optional: Set up a separate cron job for cache management:"
echo "   0 0 * * * cd /path/to/ytDiscord && /usr/bin/node api/manage-cache.js clean"
echo "   (This will clean the cache daily at midnight)"
