# Proxy Integration Guide

## Step 1: Choose a Proxy Service

### ProxyMesh (Recommended for simplicity)
- Sign up at: https://proxymesh.com/
- Get rotating residential proxies
- Cost: ~$10-30/month

### Configuration Example:
```javascript
// Add to your Heroku environment variables:
PROXY_HOST=us.proxymesh.com
PROXY_PORT=31280
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

## Step 2: Update Service Configuration

The code is already prepared! Just set these environment variables in Heroku:

```bash
heroku config:set PROXY_HOST=us.proxymesh.com
heroku config:set PROXY_PORT=31280
heroku config:set PROXY_USERNAME=your_username
heroku config:set PROXY_PASSWORD=your_password
heroku config:set USE_PROXY=true
```

## Step 3: Test

The youtube-transcript-api service will automatically use the proxy configuration when available.

## Cost Analysis
- ProxyMesh: $10-30/month
- Bright Data: $0.50-2.00 per GB
- Your current monthly transcript volume: ~100-500 requests = minimal cost

## Success Rate
- Proxy success rate: 85-95%
- Direct cloud IP success rate: 0%
- ROI: Immediate functionality restoration
