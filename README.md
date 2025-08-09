# YouTube to Discord AI Automation Bot

A Node.js bot that automatically extracts transcripts from YouTube videos posted in Discord, generates AI summaries using custom prompts, and creates daily reports.

## Features

- 🔍 Monitors Discord channels for YouTube links
- 📝 Extracts video transcripts using yt-dlp (primary) or Tactiq.io via Puppeteer (fallback)
- 🤖 Generates AI summaries using OpenAI with customizable prompts
- 📊 Creates daily reports of all summarized videos
- ⚙️ Configurable via environment variables and pinned Discord messages

## Setup

### Prerequisites

- Node.js 16.9.0 or higher
- Discord Bot Token with Message Content intent enabled
- OpenAI API Key
- YouTube API Key (optional, for video title fetching)
- yt-dlp installed (`brew install yt-dlp` on macOS, `apt install yt-dlp` on Ubuntu)

### Cache Management

The bot caches transcripts and summaries to improve performance and reduce API calls. To manage the cache:

```bash
# View cache statistics
node api/manage-cache.js stats

# Clean cache (remove files older than 30 days or if total size exceeds 500MB)
node api/manage-cache.js clean

# Clean with custom parameters (e.g., 15 days max age, 200MB max size)
node api/manage-cache.js clean 15 200
```

By default, the cache cleaning is automatically run daily to prevent excessive disk usage.
- Discord server with appropriate channels set up

### Discord Channel Structure

Set up the following channels in your Discord server:

- `#yt-uploads`: Where YouTube links are posted
- `#yt-transcripts`: (Optional) Stores raw transcripts
- `#yt-summary-prompt-1`, `#yt-summary-prompt-2`, etc.: Channels with pinned prompts for summarization
- `#yt-summaries-1`, `#yt-summaries-2`, etc.: Where generated summaries are posted
- `#yt-daily-report-prompt-1`, `#yt-daily-report-prompt-2`, etc.: Channels with pinned prompts for daily reports
- `#daily-report`: Where daily reports are posted

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
   YOUTUBE_API_KEY=your_youtube_api_key

   # Channel Prefix Configuration
   SUMMARY_PROMPT_PREFIX=yt-summary-prompt-
   SUMMARIES_OUTPUT_PREFIX=yt-summaries-
   DAILY_REPORT_PROMPT_PREFIX=yt-daily-report-prompt-

   # Daily Report Schedule (CEST)
   DAILY_REPORT_HOUR=18
   DAILY_REPORT_MINUTE=0

   # Optional Configuration
   CACHE_TRANSCRIPTS=true
   DEBUG_MODE=false
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

### Manual Triggers

You can manually trigger summary generation or daily reports using:

```
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
