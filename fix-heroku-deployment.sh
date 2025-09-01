#!/bin/bash

# Heroku Deployment Fix Script
# This script prepares the app for reliable Heroku deployment

echo "🚀 Preparing Heroku deployment fix..."

# 1. Ensure Python buildpack is properly configured
echo "📦 Checking buildpack configuration..."
heroku buildpacks:clear --app yt-discord-automation
heroku buildpacks:add heroku/python --app yt-discord-automation  
heroku buildpacks:add heroku/nodejs --app yt-discord-automation

# 2. Set environment variables for Python
echo "🔧 Setting Python environment..."
heroku config:set PYTHONPATH=/app --app yt-discord-automation
heroku config:set PYTHON_VERSION=3.11.0 --app yt-discord-automation

# 3. Set Node.js environment
heroku config:set NODE_ENV=production --app yt-discord-automation
heroku config:set NPM_CONFIG_PRODUCTION=false --app yt-discord-automation

# 4. Display current config
echo "📋 Current Heroku configuration:"
heroku config --app yt-discord-automation

echo "✅ Heroku configuration updated!"
echo "📤 Ready to deploy with: git push heroku main"
