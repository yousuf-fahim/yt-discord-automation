# YouTube to Discord AI Automation Bot - AI Agent Instructions

## Project Overview

This is a Node.js bot that automates the process of:
1. Monitoring Discord channels for YouTube links
2. Extracting video transcripts using a multi-service strategy
3. Generating AI summaries using OpenAI
4. Creating daily reports of summarized videos

## Core Architecture 

### Major Components

- `src/services/` - Core services using dependency injection:
  - `transcript.service.js`: Multi-strategy transcript extraction orchestrator
  - `summary.service.js`: OpenAI integration for summarization
  - `report.service.js`: Daily report compilation
  - `discord.service.js`: Discord bot interactions
- `src/core/service-manager.js`: Dependency injection container
- `vps-transcript-api/`: Standalone transcript extraction API

### Data Flow & Service Strategy

1. Discord message → Link extraction (`discord.service.js`)
2. Video ID → Transcript extraction (`transcript.service.js`):
   ```js
   // Multi-layered transcript extraction:
   1. Try VPS Transcript API (residential IP)
   2. Fallback to local YouTube API
   3. Final fallback to RapidAPI provider
   ```
3. Transcript → AI Summary (`summary.service.js`) 
4. Summaries → Daily report (`report.service.js`)

## Key Patterns & Conventions

### Error-Resilient Transcript Extraction

```javascript
// Example from transcript.service.js
class TranscriptService {
  async getTranscript(videoId, options = {}) {
    try {
      // Try VPS service first (residential IP)
      if (this.vpsClient) {
        const vpsResult = await this.vpsClient.getTranscript(videoId);
        if (vpsResult) return vpsResult;
      }
      
      // Fallback to local service
      const result = await this.youtubeApi.getTranscript(videoId);
      if (result) return result;
      
      return null;
    } catch (error) {
      this.logger.error('All transcript sources exhausted');
      return null;
    }
  }
}
```

### Caching System

- Location: `cache/` directory
- Formats:
  - Transcripts: `{videoId}_transcript.json`
  - Summaries: `{videoId}_summary_{timestamp}.json` 
  - Daily Reports: `daily_report_{date}.json`
- Management: Use `src/services/cache.service.js` APIs

### Service Integration Points

Required environment variables:
```bash
# Core APIs
DISCORD_BOT_TOKEN=  
DISCORD_GUILD_ID=
OPENAI_API_KEY=

# Transcript Services
VPS_TRANSCRIPT_API_URL=  # Optional, enables VPS service
RAPIDAPI_KEY=           # Optional, enables RapidAPI fallback
YOUTUBE_API_KEY=        # Optional, for video metadata
```

### Development Workflows

#### Local Testing
```bash
# Test transcript extraction
node scripts/test-local.sh <video-id>

# Test daily report generation 
node test-daily-report-new.js
```

#### Health Monitoring
```javascript
// Example from health-check.js
await transcriptService.healthCheck();
await summaryService.healthCheck();
```

## Common Issues & Solutions

1. YouTube API Blocks:
   - Use VPS service as primary source
   - Configure proxy if needed for local service
   - RapidAPI as final fallback

2. Cache Management:
   - Regular cleanup with `cache.service.js`
   - Monitor size with health checks
   - Configurable retention periods

3. Discord Rate Limits:
   - Built-in queue system in `discord.service.js`
   - Automatic retry with exponential backoff

Remember to check `utils/monitoring.js` logs when debugging service issues. The system is designed to gracefully degrade through multiple transcript sources.
