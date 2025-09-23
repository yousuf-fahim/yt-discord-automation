# VPS Transcript API Deployment Guide

## DigitalOcean Droplet Setup

### 1. Create Droplet
- **Image**: Ubuntu 22.04 LTS
- **Size**: Basic - $6/month (1GB RAM, 25GB SSD)
- **Datacenter**: Choose closest to your users (e.g., New York, San Francisco)
- **Authentication**: SSH Key (recommended) or Password

### 2. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and pip
sudo apt install python3 python3-pip -y

# Install PM2 for process management
sudo npm install -g pm2

# Create app user
sudo adduser --disabled-password --gecos "" ytapp
sudo usermod -aG sudo ytapp
```

### 3. Deploy Application

```bash
# Switch to app user
sudo su - ytapp

# Clone your repository
git clone https://github.com/yousuf-fahim/yt-discord-automation.git
cd yt-discord-automation/vps-transcript-api

# Install Node.js dependencies
npm install

# Install Python dependencies
pip3 install youtube-transcript-api

# Test locally
npm test
```

### 4. Production Setup

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'transcript-api',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      CACHE_DIR: '/home/ytapp/cache'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Setup nginx reverse proxy
sudo apt install nginx -y

# Configure nginx
sudo tee /etc/nginx/sites-available/transcript-api << 'EOF'
server {
    listen 80;
    server_name your-droplet-ip;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/transcript-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 5. SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Testing Deployment

```bash
# Test health endpoint
curl http://your-droplet-ip/health

# Test transcript extraction
curl http://your-droplet-ip/transcript/jNQXAC9IVRw
```

## Monitoring

```bash
# Check PM2 status
pm2 status
pm2 logs transcript-api

# Check nginx status
sudo systemctl status nginx

# Check system resources
htop
df -h
```
