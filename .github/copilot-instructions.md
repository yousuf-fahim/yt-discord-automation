# YouTube to Discord AI Automation Bot - AI Agent Instructions

## Project Overview

This is a Node.js bot that automates the process of:
1. Monitoring Discord channels for YouTube links
2. Extracting video transcripts using multiple methods
3. Generating AI summaries using OpenAI
4. Creating daily reports of summarized videos

## Core Architecture

### Major Components

- `api/listener.js`: Main Discord bot entry point that monitors messages
- `api/transcript.js`: Multi-strategy transcript extraction service
- `api/summary.js`: OpenAI-based summarization service
- `api/report.js`: Daily report generation service
- `utils/*.js`: Shared utilities for YouTube, Discord, OpenAI, and caching

### Data Flow

1. Discord message → YouTube link extraction (`listener.js`)
2. Video ID → Transcript extraction (`transcript.js`)
   - Primary: YouTube Transcript API 
   - Fallback: Direct YouTube scraping via Puppeteer
3. Transcript → AI Summary generation (`summary.js`)
4. Summaries → Daily report compilation (`report.js`)

## Key Patterns & Conventions

### Transcript Extraction Strategy

The system uses a multi-layered approach for reliability:

```javascript
// Example from transcript.js
1. Try YouTube Transcript API with multiple language options
2. Fallback to direct YouTube page scraping if API fails
3. Cache successful transcripts for future use
```

### Caching System

- Location: `cache/` directory
- Format: JSON files named `{videoId}_summary_1.json` for summaries
- Management: Use `api/manage-cache.js` for cleanup

### Error Handling

- Extensive retry logic for transcript extraction (see `MAX_RETRIES` in `transcript.js`)
- Graceful degradation between transcript extraction methods
- Detailed logging for debugging

## Development Workflows

### Local Setup

1. Install dependencies:
```bash
npm install
yt-dlp # Required for transcript extraction
```

2. Environment Configuration:
```
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
OPENAI_API_KEY=
YOUTUBE_API_KEY= # Optional, for titles
```

### Testing

- Use `test-*.js` files for testing individual components
- Sample test transcripts available in `test-transcript-output.txt`

### Cache Management

```bash
# View cache stats
node api/manage-cache.js stats

# Clean old cache files
node api/manage-cache.js clean [days] [maxSizeMB]
```

## Integration Points

### Discord Channels

Required channel structure:
- `#yt-uploads`: Input channel for YouTube links
- `#yt-summary-prompt-*`: Channels with pinned prompts
- `#yt-summaries-*`: Output channels for summaries
- `#daily-report`: Daily report output

### External APIs

1. Discord Bot API
   - Required Intents: Guilds, GuildMessages, MessageContent
2. OpenAI API 
   - Default model: gpt-4-turbo
3. YouTube Data API (optional)
   - Used only for video title fetching

## Common Gotchas

1. YouTube Shorts/Live videos are intentionally skipped (see `isYouTubeShort`, `isYouTubeLive` checks)
2. Puppeteer requires specific Chrome setup in production (see Chrome buildpack config)
3. Daily reports are scheduled in CEST timezone (configurable via env vars)

Remember to check the cache directory size periodically as transcripts and summaries can accumulate quickly.
