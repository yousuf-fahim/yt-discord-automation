# YouTube to Discord AI Automation Bot

A Node.js bot that automatically extracts transcripts from YouTube videos posted in Discord, generates AI summaries using custom prompts, and creates daily reports. Includes comprehensive slash commands for management and debugging.

## Features

- 🔍 Monitors Discord channels for YouTube links
- 📝 Extracts video transcripts using YouTube Transcript IO API
- 🤖 Generates AI summaries using OpenAI with customizable prompts
- 📊 Creates daily reports of all summarized videos
- ⚙️ Modern ServiceManager architecture with dependency injection
- 🏗️ Configurable via environment variables and pinned Discord messages
- 🤖 **12 Comprehensive Slash Commands** for management, debugging, and monitoring
- 💾 Intelligent cache management with debugging tools
- 🚨 Robust error handling and empty state management

## Architecture

### Modern Architecture (src/)
- **ServiceManager**: Dependency injection and service lifecycle management
- **Discord Service**: Bot interactions and message handling
- **Transcript Service**: YouTube transcript extraction using youtube-transcript-api
- **Summary Service**: OpenAI integration for content summarization
- **Report Service**: Daily report generation and scheduling
- **Cache Service**: Intelligent caching for performance

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
   OPENAI_MODEL=gpt-4-turbo
   
   # YouTube Configuration
   YOUTUBE_TRANSCRIPT_IO_TOKEN=your_youtube_transcript_io_api_token

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

1. When a YouTube link is posted in `#yt-uploads`, the bot extracts the video ID
2. The bot uses yt-dlp (primary) or Puppeteer (fallback) to fetch the transcript
3. For each prompt channel, the bot:
   - Gets the pinned message (prompt)
   - Sends the transcript + prompt to OpenAI
   - Formats the JSON summary into readable Discord markdown
   - Posts the resulting summary to the corresponding output channel
4. Every day at 18:00 CEST, the bot:
   - Gathers all summaries generated that day
   - For each daily report prompt, generates a report using OpenAI
   - Posts the report to `#daily-report`

## 🤖 Slash Commands

The bot includes **12 comprehensive slash commands** for complete system management. For detailed documentation, see [SLASH_COMMANDS.md](SLASH_COMMANDS.md).

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

## Limitations

- Very long transcripts may need to be split into multiple API calls
- The bot does not process YouTube Shorts or Live videos
- yt-dlp must be installed on the system for optimal transcript extraction
- YouTube API key is required for video title display (falls back to URL if not provided)

## License

MIT
