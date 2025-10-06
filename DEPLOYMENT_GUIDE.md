# 🚀 YouTube Discord Automation Bot - Enhanced Database Version

## 🎯 What's New in This Release

### ✅ **Fixed Issues**
- **Date Handling Bug** - Reports now correctly identify today vs yesterday
- **Cache Format Consistency** - Standardized data structure across all services
- **Report Generation** - Daily reports properly cached and persistent
- **Summary Delivery** - Robust error handling with fallback mechanisms

### 🗄️ **New Database Features**
- **SQLite Integration** - Persistent storage with optimized schema
- **Hybrid Architecture** - Fast cache + reliable database storage
- **Advanced Search** - Find summaries by content or title
- **Analytics Tracking** - Monitor bot performance and usage trends
- **Automated Backups** - Built-in database backup capabilities

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 20.x or higher
- Discord Bot Token
- OpenAI API Key

### 1. Environment Setup
```bash
# Clone and setup
git clone <your-repo>
cd yt-discord-automation
npm install

# Copy environment variables
cp .env.example .env
```

### 2. Configure Environment Variables
```bash
# Required
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_server_id
OPENAI_API_KEY=your_openai_api_key

# Optional (with defaults)
DISCORD_YT_SUMMARIES_CHANNEL=yt-uploads
DISCORD_YT_TRANSCRIPTS_CHANNEL=yt-transcripts
DISCORD_DAILY_REPORT_CHANNEL=daily-report
DATABASE_PATH=./data/bot.db
```

### 3. Test Everything Works
```bash
# Run comprehensive tests
npm run test-all
# or individual tests
node test-final-verification.js
node test-database-integration.js
```

### 4. Start the Bot
```bash
# Development
npm run dev

# Production
npm start
```

---

## 📊 Database Architecture

### Schema Overview
```sql
-- Core Data Tables
summaries        → Video summaries with metadata
daily_reports    → Generated daily reports
video_metadata   → Video details (duration, channel, etc.)
analytics        → Performance tracking
system_logs      → Structured logging
```

### Data Flow
```
YouTube Link → Transcript → AI Summary → [Cache + Database] → Discord
```

### Storage Strategy
- **Cache**: Today's active data for fast access
- **Database**: Complete history for persistence and analytics
- **Fallback**: Database serves data if cache is empty

---

## 🎮 Discord Commands

### Basic Commands
```
/summary <youtube-url>                    → Generate summary for video
/summary <youtube-url> custom: <prompt>   → Custom summarization prompt
/daily-report                            → Generate today's report
/daily-report custom: <prompt>           → Custom report format
```

### Management Commands
```
/check-summaries                         → View recent summaries
/check-summaries all-dates: true         → View all dates with summaries
/clear-cache <type>                      → Clear specific cache data
/health                                  → Bot health status
```

### Analytics Commands
```
/analytics                               → View bot performance stats
/search <query>                          → Search summaries by content
/backup                                  → Create database backup
```

---

## 🔧 Advanced Configuration

### Database Settings
```javascript
// Automatic in production, but configurable:
DATABASE_PATH=./data/bot.db              // Local SQLite file
BACKUP_RETENTION_DAYS=30                 // How long to keep backups
CACHE_TTL_HOURS=24                       // Cache expiration time
```

### Performance Tuning
```javascript
// OpenAI Model Configuration
OPENAI_MODEL=gpt-4o                      // Recommended for balance
OPENAI_MAX_TOKENS=16000                  // Context window size
OPENAI_TEMPERATURE=0.3                   // Creativity level
```

### Monitoring Settings
```javascript
NODE_ENV=production                      // Enable production optimizations
DEBUG_LOGS=false                         // Disable verbose logging
HEALTH_CHECK_PORT=3000                   // For uptime monitoring
```

---

## 📈 Analytics & Monitoring

### Built-in Analytics
- **Daily Processing Stats** - Videos processed, summaries generated
- **Performance Metrics** - Average processing time, token usage
- **Content Analytics** - Word counts, summary quality scores
- **Error Tracking** - Failed requests, API issues

### Database Queries
```sql
-- Recent activity
SELECT COUNT(*) FROM summaries WHERE DATE(created_at) = DATE('now');

-- Popular topics
SELECT title FROM summaries WHERE content LIKE '%AI%' LIMIT 10;

-- Performance trends
SELECT date, videos_processed, avg_summary_length 
FROM analytics 
ORDER BY date DESC LIMIT 30;
```

### Health Monitoring
```bash
# Check bot status
curl http://localhost:3000/health

# Database stats
node -e "
const DatabaseService = require('./src/services/database.service.js');
const db = new DatabaseService();
db.initialize().then(() => db.getStats()).then(console.log);
"
```

---

## 🛡️ Backup & Recovery

### Automatic Backups
The bot includes built-in backup functionality:

```javascript
// Programmatic backup
const databaseService = await serviceManager.getService('database');
const backupPath = await databaseService.createBackup();
console.log(`Backup created: ${backupPath}`);
```

### Manual Backup
```bash
# Simple file copy (bot should be stopped)
cp data/bot.db backups/bot-$(date +%Y%m%d).db

# Or use built-in backup command
node -e "
const DatabaseService = require('./src/services/database.service.js');
const db = new DatabaseService({logger: console}, {});
db.initialize().then(() => db.createBackup()).then(console.log);
"
```

### Disaster Recovery
```bash
# Restore from backup
cp backups/bot-20251006.db data/bot.db

# Verify integrity
node test-database-integration.js
```

---

## 🚀 Deployment Options

### Option 1: Heroku (Recommended)
```bash
# Install Heroku CLI, then:
heroku create your-bot-name
heroku config:set DISCORD_BOT_TOKEN=xxx
heroku config:set OPENAI_API_KEY=xxx
heroku config:set DISCORD_GUILD_ID=xxx
git push heroku main
```

**Note**: Heroku has ephemeral filesystem. For persistent database:
- Use Heroku Postgres addon for production
- Or implement regular backups to cloud storage

### Option 2: VPS/Dedicated Server
```bash
# Using PM2 for process management
npm install -g pm2
pm2 start src/main.js --name "yt-discord-bot"
pm2 startup
pm2 save
```

### Option 3: Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 🐛 Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Check database file permissions
ls -la data/bot.db
chmod 664 data/bot.db

# Verify database integrity
sqlite3 data/bot.db "PRAGMA integrity_check;"
```

**2. Service Initialization Failures**
```bash
# Check environment variables
node -e "console.log(process.env.DISCORD_BOT_TOKEN ? 'Discord token OK' : 'Missing Discord token')"
node -e "console.log(process.env.OPENAI_API_KEY ? 'OpenAI key OK' : 'Missing OpenAI key')"

# Test service initialization
node test-final-verification.js
```

**3. Memory Issues**
```bash
# Check memory usage
node -e "console.log(process.memoryUsage())"

# Enable garbage collection logging
node --expose-gc --trace-gc src/main.js
```

**4. Discord Rate Limiting**
```bash
# Check bot permissions in Discord server
# Ensure bot has: Send Messages, Attach Files, Read Message History

# Monitor rate limits in logs
grep "rate limit" logs/bot.log
```

### Debug Mode
```bash
# Enable verbose logging
DEBUG_LOGS=true npm start

# Database debugging
DATABASE_DEBUG=true npm start

# OpenAI API debugging
OPENAI_DEBUG=true npm start
```

---

## 📚 API Reference

### Database Service Methods
```javascript
// Summary operations
await database.saveSummary({videoId, title, content, url});
await database.getRecentSummaries(24); // last 24 hours
await database.searchSummaries('AI'); // content search

// Report operations
await database.saveDailyReport({date, content, summaryCount});
await database.getDailyReport('2025-10-06');

// Analytics
await database.recordDailyAnalytics(date, stats);
await database.getAnalytics(startDate, endDate);

// Utilities
await database.getStats(); // database statistics
await database.createBackup(); // backup creation
await database.healthCheck(); // health status
```

### Cache Service Methods
```javascript
// Standard cache operations
await cache.get(key);
await cache.set(key, value);
await cache.delete(key);

// Summary-specific
await cache.getTodaysSummaries();
await cache.listSummaries(); // all dates

// Management
await cache.cleanup(); // remove old entries
await cache.getStats(); // cache statistics
```

---

## 🎯 Performance Optimization

### Database Optimization
- **WAL Mode**: Enabled for better concurrent access
- **Indexes**: Optimized for common queries
- **Pragmas**: Configured for performance over durability

### Memory Management
- **Streaming**: Large transcripts processed in chunks
- **Caching Strategy**: Active data in memory, history in database
- **Garbage Collection**: Automatic cleanup of unused objects

### API Efficiency
- **Token Optimization**: Intelligent context window management
- **Batch Processing**: Multiple summaries in single session
- **Rate Limiting**: Automatic backoff and retry logic

---

## 📋 Maintenance Tasks

### Daily
- Monitor bot health via `/health` endpoint
- Check error logs for any issues
- Verify daily reports are generating

### Weekly
- Review analytics trends
- Clean up old cache files
- Check database size growth

### Monthly
- Create manual database backup
- Review and rotate log files
- Update dependencies if needed
- Analyze usage patterns for optimization

---

## 🤝 Contributing

### Development Setup
```bash
# Fork and clone repo
git clone <your-fork>
cd yt-discord-automation

# Install development dependencies
npm install

# Run tests before changes
npm run test-all

# Make changes and test
node test-final-verification.js

# Commit with descriptive messages
git commit -m "feat: add new feature description"
```

### Testing Guidelines
- Run `test-final-verification.js` for end-to-end testing
- Run `test-database-integration.js` for database testing
- Test both empty and active data scenarios
- Verify cache and database consistency

---

## 📞 Support

### Getting Help
1. **Check Logs**: Most issues are logged with clear error messages
2. **Run Health Check**: `node test-final-verification.js`
3. **Database Status**: `node test-database-integration.js`
4. **Discord Permissions**: Verify bot has necessary permissions

### Performance Issues
- Check database size: `ls -lh data/bot.db`
- Monitor memory usage: `top -p $(pgrep node)`
- Review analytics: Check daily processing stats

---

**🎉 Your enhanced YouTube Discord Automation Bot is ready for production!**

The hybrid cache+database architecture provides the perfect balance of speed and reliability, while the comprehensive analytics help you monitor and optimize performance over time.