# VPS Transcript API

A standalone Express API for YouTube transcript extraction, designed to run on DigitalOcean VPS.

## Features

- RESTful API for transcript extraction
- No proxy needed (VPS has residential-class IP)
- Caching support
- Health monitoring
- Error handling

## API Endpoints

- `GET /health` - Health check
- `GET /transcript/:videoId` - Extract transcript for video
- `GET /transcript/:videoId?lang=en` - Extract with language preference

## Deployment

This service runs independently on DigitalOcean VPS while the main Discord bot remains on Heroku.

## Environment Variables

```
PORT=3000
CACHE_DIR=/tmp/transcripts
NODE_ENV=production
```
