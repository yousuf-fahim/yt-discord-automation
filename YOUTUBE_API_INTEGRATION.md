# YouTube Data API Integration

## Overview
Use YouTube's official API for captions instead of web scraping.

## Pros:
- Official API (no blocking)
- Reliable and stable
- Works from any IP

## Cons:
- Requires API key and quota management
- 10,000 units per day free quota
- Each caption request costs ~1-3 units
- May not have captions for all videos

## Implementation Steps:

### 1. Get YouTube Data API Key
- Go to https://console.cloud.google.com/
- Create new project or use existing
- Enable YouTube Data API v3
- Create credentials (API key)
- Add to Heroku: `heroku config:set YOUTUBE_API_KEY=your_key`

### 2. Update Service
```javascript
// Add to youtube-transcript-api.service.js
async function getOfficialCaptions(videoId) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
  );
  const data = await response.json();
  
  if (data.items && data.items.length > 0) {
    const captionId = data.items[0].id;
    // Download caption content...
  }
}
```

### 3. Quota Management
- Monitor daily usage
- Implement fallback to cached transcripts
- Priority system for important videos

## Cost:
- Free tier: 10,000 units/day
- Paid: $0.50 per 1,000 additional units
- Typical usage: ~100-500 requests/day = well within free tier
