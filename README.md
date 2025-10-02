# YouTube to Discord AI Automation Bot

A Node.js bot that automatically extracts transcripts from YouTube videos posted in Discord, generates AI summaries using custom prompts, and creates daily reports. Includes comprehensive slash commands for management and debugging.

## Features

- 🔍 Monitors Discord channels for YouTube links
- 📝 Multi-strategy transcript extraction with VPS fallback support
- 🤖 **GPT-5 & GPT-4 Support** with intelligent context window optimization (110K tokens for GPT-5)
- 🎯 Generates AI summaries using OpenAI with customizable prompts
- 📊 Creates daily/weekly/monthly reports of all summarized videos
- ⚙️ Modern ServiceManager architecture with dependency injection
- 🏗️ Configurable via environment variables and pinned Discord messages
- 🤖 **17 Comprehensive Slash Commands** for management, debugging, and monitoring
- 💾 Intelligent cache management with backward compatibility
- 📎 Smart Discord message handling with auto file attachments for long responses
- 🚨 Robust error handling and health monitoring (100% operational status)

## Architecture

### Modern Architecture (src/)
- **ServiceManager**: Dependency injection and service lifecycle management
- **Discord Service**: Bot interactions, message handling, and auto file attachments (Discord.js v14)
- **Transcript Service**: Multi-strategy extraction (VPS → Local → RapidAPI fallback)
- **Summary Service**: OpenAI integration with GPT-5/GPT-4 support and context optimization
- **Report Service**: Daily/weekly/monthly report generation and scheduling
- **Cache Service**: Intelligent caching with format versioning and backward compatibility
- **Command Service**: 17 slash commands for comprehensive bot management

### Entry Points
- **Development**: `npm run dev` (with nodemon auto-restart)
- **Production**: `npm start`
- **Heroku**: Automatic via Procfile

## Setup

### Prerequisites

- Node.js 16.9.0 or higher
- Discord Bot Token with Message Content intent enabled
- OpenAI API Key
- YouTube API Key (optional, for video title fetching)
- Python 3 with `youtube-transcript-api` package (`pip install youtube-transcript-api`)

### Local Development

```bash
# Install dependencies
npm install

# Install Python package for transcript extraction
pip install youtube-transcript-api

# Start development server (with auto-restart)
npm run dev

# Or start production mode
npm start
```

### Cache Management

The bot automatically caches transcripts and summaries through the CacheService to improve performance and reduce API calls. Cache is managed through the ServiceManager architecture.

For manual cache management (using legacy tools):

```bash
# View cache statistics  
node api/manage-cache.js stats

# Clean cache (remove files older than 30 days or if total size exceeds 500MB)
node api/manage-cache.js clean

# Clean with custom parameters (e.g., 15 days max age, 200MB max size)
node api/manage-cache.js clean 15 200
```

The modern architecture includes intelligent cache management built into the services.
- Discord server with appropriate channels set up

### Discord Channel Structure

Set up the following channels in your Discord server:

- `#yt-uploads`: Where YouTube links are posted
- `#yt-transcripts`: (Optional) Stores raw transcripts
- `#yt-summary-prompt-*`: Channels with pinned prompts for summarization (e.g., yt-summary-prompt-1, yt-summary-prompt-dev)
- `#yt-summaries-*`: Where generated summaries are posted (must match prompt suffix, e.g., yt-summaries-1, yt-summaries-dev)
- `#yt-daily-report-prompt-1`, `#yt-daily-report-prompt-2`, etc.: Channels with pinned prompts for daily reports
- `#yt-weekly-report-prompt-1`, `#yt-weekly-report-prompt-2`, etc.: Channels with pinned prompts for weekly reports
- `#yt-monthly-report-prompt-1`, `#yt-monthly-report-prompt-2`, etc.: Channels with pinned prompts for monthly reports
- `#daily-report`: Where daily reports are posted
- `#weekly-report`, `#weekly-report-2`, etc.: Where weekly reports are posted
- `#monthly-report`, `#monthly-report-2`, etc.: Where monthly reports are posted

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   # Discord Bot Configuration
   DISCORD_BOT_TOKEN=your_discord_bot_token
   DISCORD_GUILD_ID=your_guild_id
   DISCORD_YT_SUMMARIES_CHANNEL=yt-uploads
   DISCORD_YT_TRANSCRIPTS_CHANNEL=yt-transcripts
   DISCORD_DAILY_REPORT_CHANNEL=daily-report

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-5  # Supports: gpt-5, gpt-4o, gpt-4-turbo, gpt-3.5-turbo
   OPENAI_MAX_TOKENS=16000  # GPT-5: 16K, GPT-4: 4K recommended
   
   # YouTube Configuration (Multi-Strategy Transcript Extraction)
   YOUTUBE_TRANSCRIPT_IO_TOKEN=your_youtube_transcript_io_api_token
   VPS_TRANSCRIPT_API_URL=http://your-vps:3000  # Optional: VPS service with residential IP
   RAPIDAPI_KEY=your_rapidapi_key  # Optional: Final fallback for transcript extraction

   # Channel Prefix Configuration
   SUMMARY_PROMPT_PREFIX=yt-summary-prompt-
   SUMMARIES_OUTPUT_PREFIX=yt-summaries-
   DAILY_REPORT_PROMPT_PREFIX=yt-daily-report-prompt-
   WEEKLY_REPORT_PROMPT_PREFIX=yt-weekly-report-prompt-
   MONTHLY_REPORT_PROMPT_PREFIX=yt-monthly-report-prompt-

   # Daily Report Schedule (CEST)
   DAILY_REPORT_HOUR=18
   DAILY_REPORT_MINUTE=0

   # Optional Configuration
   CACHE_TRANSCRIPTS=true
   DEBUG_MODE=false
   
   # Bot Message Processing (Optional)
   DISCORD_ALLOWED_CHANNELS=youtube,videos,media,links,general,notifications
   DISCORD_TRUSTED_BOTS=NotifyMe,IFTTT,Zapier,YouTube,RSS
   ```

### Setting Up Prompts

Pin a message in each prompt channel with your desired prompt format. For example:

```
You're an advanced content summarizer.
Your task is to analyze the transcript of a YouTube video and return a concise summary in JSON format only.
Include the video's topic, key points, and any noteworthy mentions.
Do not include anything outside of the JSON block. Be accurate, structured, and informative.

Format:
{
  "title": "Insert video title here",
  "summary": ["Point 1", "Point 2"],
  "noteworthy_mentions": ["Mention 1"],
  "verdict": "Brief takeaway"
}
```

### Running Locally

```
npm start
```

For development with auto-restart:

```
npm run dev
```

### Deployment

#### Vercel

This project includes a `vercel.json` configuration file for easy deployment to Vercel:

1. Install Vercel CLI:
   ```
   npm i -g vercel
   ```

2. Deploy:
   ```
   vercel
   ```

#### Heroku

For Puppeteer support on Heroku, add the following buildpacks:

1. `heroku/nodejs`
2. `https://github.com/jontewks/puppeteer-heroku-buildpack`

## How It Works

1. **Link Detection**: When a YouTube link is posted in `#yt-uploads`, the bot extracts the video ID
2. **Transcript Extraction** (Multi-Strategy Fallback):
   - **Primary**: VPS Transcript API (residential IP, bypasses rate limits)
   - **Fallback**: Local YouTube Transcript API
   - **Final Fallback**: RapidAPI provider
3. **Smart Summarization**: For each prompt channel, the bot:
   - Gets the pinned message (custom prompt)
   - Optimizes transcript for model context window (110K tokens for GPT-5)
   - Sends transcript + prompt to OpenAI with model-specific parameters
   - Handles long responses with auto file attachments (>2000 chars)
   - Formats JSON summary into readable Discord markdown
   - Posts to the corresponding output channel
4. **Scheduled Reports**: Every day at 18:00 CEST:
   - Gathers all summaries generated that day from cache
   - For each report prompt channel, generates a comprehensive report using OpenAI
   - Posts formatted report to designated report channels

## 🤖 Slash Commands

The bot includes **17 comprehensive slash commands** for complete system management. For detailed documentation, see [SLASH_COMMANDS.md](SLASH_COMMANDS.md).

### Quick Reference

**System Health & Monitoring:**
- `/health` - Check all service status
- `/logs [lines]` - View recent bot activity
- `/channel-status` - Check monitored channels

**Daily Reports:**
- `/trigger-report [channel]` - Manually generate reports
- `/check-summaries [all-dates]` - Verify cached summaries

**Video Processing:**
- `/test-summary <video-url> [channel]` - Process single video
- `/transcript-test <video-id>` - Test transcript extraction

**Cache Management:**
- `/cache-stats [cleanup]` - View storage usage
- `/debug-cache [pattern]` - Investigate cache issues
- `/clear-cache <type> [date]` - Reset system state

**Configuration:**
- `/reload-prompts` - Refresh prompts from Discord
- `/validate-prompts` - Check prompt configuration

### Manual Triggers (Legacy)

You can also manually trigger operations using legacy scripts:

```bash
# Generate summary for a specific video
node api/manual-trigger.js summary dQw4w9WgXcQ "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Generate daily report
node api/manual-trigger.js report
```

## Recent Improvements

### GPT-5 Support & Context Optimization
- ✅ Full GPT-5 compatibility with correct API parameters (`max_completion_tokens`)
- ✅ Intelligent context window optimization (110K tokens for GPT-5, 128K for gpt-4o)
- ✅ Smart transcript extraction for large videos (beginning + middle + end strategy)
- ✅ Model-specific parameter handling for reasoning models (GPT-5, o1, o3)

### Enhanced Discord Integration
- ✅ Auto file attachments for responses >2000 characters (Discord.js v14)
- ✅ JSON auto-detection with proper formatting
- ✅ Improved message handling with graceful degradation

### Cache & Reliability
- ✅ Backward-compatible cache format (handles both old and new formats)
- ✅ Comprehensive health monitoring (100% operational status)
- ✅ All 17 slash commands validated and working

### Performance Metrics
- **Summary Generation**: ~39-65s with GPT-5 (expected due to reasoning model)
- **Alternative**: Use `OPENAI_MODEL=gpt-4o` for 2-4s responses with slight quality trade-off
- **Cache Hit Rate**: High performance with intelligent caching
- **Health Score**: 100% (36/36 tests passing)

## Known Limitations

- GPT-5 is slower (39-65s per summary) due to reasoning capabilities—use GPT-4o for faster responses
- Very long transcripts (>110K tokens) are intelligently truncated to fit context windows
- YouTube Shorts and Live videos may have limited transcript availability
- Multi-strategy transcript extraction ensures high success rate, but some videos may still fail

## License

MIT
