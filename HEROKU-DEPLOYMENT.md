# 🚀 Heroku Deployment Guide

## ✅ Pre-Deployment Checklist

### All Critical Issues Fixed:
- [x] **Procfile**: Changed from `worker` to `web` 
- [x] **Python Version**: Dynamic detection in post_compile
- [x] **yt-dlp Paths**: Heroku-specific path prioritization
- [x] **Temp Directories**: Uses `/tmp` in Heroku environment
- [x] **Environment Variables**: Heroku-specific configuration
- [x] **File Permissions**: Proper directory setup
- [x] **Transcript Optimization**: Removed failing methods
- [x] **Error Handling**: Fast failure for unavailable videos

## 🏗️ Deployment Steps

### 1. Test Local Heroku Readiness
```bash
npm run test:heroku
```
**Expected Result**: All 7 tests should pass (100% success rate)

### 2. Set Up Heroku App
```bash
# Create Heroku app
heroku create your-app-name

# Add buildpacks (order matters!)
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add heroku/python

# Verify buildpack order
heroku buildpacks
```

### 3. Configure Environment Variables
```bash
# Required variables
heroku config:set DISCORD_BOT_TOKEN="your_token_here"
heroku config:set DISCORD_GUILD_ID="your_server_id"
heroku config:set OPENAI_API_KEY="your_openai_key"

# Optional variables (with defaults)
heroku config:set DISCORD_YT_SUMMARIES_CHANNEL="yt-uploads"
heroku config:set DISCORD_YT_TRANSCRIPTS_CHANNEL="yt-transcripts"
heroku config:set DISCORD_DAILY_REPORT_CHANNEL="daily-report"
heroku config:set OPENAI_MODEL="gpt-4-turbo"
heroku config:set CACHE_TRANSCRIPTS="true"
heroku config:set DEBUG_MODE="false"

# Verify all variables are set
heroku config
```

### 4. Deploy to Heroku
```bash
# Deploy
git add .
git commit -m "Heroku deployment ready"
git push heroku main

# Monitor deployment logs
heroku logs --tail
```

### 5. Verify Deployment
```bash
# Check if app is running
heroku ps

# Test transcript functionality
heroku run npm run test:heroku

# Check specific logs
heroku logs --source app --dyno web
```

## 🔧 Key Heroku Optimizations

### **Transcript Extraction**
- **Optimized Methods**: Only uses auto-generated subtitles (most reliable)
- **Heroku Paths**: Prioritizes `python3 -m yt_dlp` in production
- **Temp Directories**: Uses `/tmp/yt-discord-temp` for Heroku
- **Timeouts**: Extended to 60 seconds for cold starts
- **Environment**: Proper PATH and PYTHONPATH configuration

### **File System**
- **Cache**: Uses `/app/.cache` when available
- **Permissions**: 777 permissions for temp directories
- **Cleanup**: Automatic cleanup after processing

### **Error Handling**
- **Fast Failure**: Skips remaining methods for unavailable videos
- **Heroku Detection**: `process.env.DYNO` detection
- **Logging**: Enhanced logging for debugging

## 🚨 Troubleshooting

### **Transcript Failures**
```bash
# Check yt-dlp installation
heroku run python3 -m yt_dlp --version

# Test specific video
heroku run node -e "
const { getTranscript } = require('./api/transcript');
getTranscript('jNQXAC9IVRw').then(console.log);
"

# Check logs
heroku logs --source app | grep -E "(yt-dlp|transcript|error)"
```

### **Environment Issues**
```bash
# Check Python environment
heroku run python3 --version
heroku run python3 -m pip list | grep yt-dlp

# Check Node.js environment  
heroku run node --version
heroku run npm list --depth=0
```

### **Discord Connection**
```bash
# Check Discord token
heroku config:get DISCORD_BOT_TOKEN

# Test Discord connection
heroku logs | grep -E "(discord|login|ready)"
```

## 📊 Expected Performance

### **Transcript Extraction**
- **Success Rate**: 80%+ for videos with auto-generated subtitles
- **Processing Time**: 30-60 seconds per video (including Heroku cold starts)
- **Reliability**: Prioritizes most reliable methods first

### **Bot Responsiveness**
- **Startup Time**: 10-30 seconds (Heroku cold start)
- **Memory Usage**: ~100-200MB typical
- **CPU Usage**: Low (event-driven processing)

## ✅ Success Indicators

### **Deployment Successful**
```
✅ Using yt-dlp command: python3 -m yt_dlp
✅ Successfully logged in to Discord
✅ Cache directories ready
✅ Bot ready and listening for YouTube links
```

### **Transcript Processing**
```
✅ Successfully extracted transcript (X chars)
✅ Summary generated successfully
✅ Summary posted to yt-summaries-X
```

## 🔄 Post-Deployment

### **Monitor Health**
```bash
# Check app status
heroku ps

# Monitor real-time logs
heroku logs --tail

# Check for errors
heroku logs | grep ERROR
```

### **Scale if Needed**
```bash
# Scale to multiple dynos if needed
heroku ps:scale web=1

# Check dyno usage
heroku ps:type
```

---

**🎉 Your bot is now Heroku-ready with optimized transcript extraction!**

*Last updated: Based on comprehensive testing and fixes applied to prevent transcript failures.*
