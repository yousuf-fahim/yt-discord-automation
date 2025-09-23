# Bot Message Processing Fix

## Problem
The NotifyMe bot (and other automation bots) were not being processed because the Discord service was configured to ignore ALL bot messages with this line:
```javascript
if (message.author.bot) return;
```

## Solution
Updated the Discord service to:

1. **Selective Bot Filtering**: Only ignore untrusted bots, allow trusted ones
2. **Flexible Channel Matching**: Process YouTube links in more channel types
3. **Configurable Trust List**: Environment variable to specify trusted bots
4. **Better Logging**: Show which bots/channels are being processed or ignored

## Changes Made

### 1. Enhanced Message Handler (`src/services/discord.service.js`)
- Replaced blanket bot blocking with selective filtering
- Added `isTrustedBot()` method to check against whitelist
- Added `shouldProcessChannel()` method for flexible channel matching
- Improved logging to show bot/user information

### 2. Configuration Updates (`src/core/service-manager.js`)
- Added `allowedChannelPatterns` configuration
- Added `trustedBots` configuration
- Both configurable via environment variables

### 3. New Environment Variables
```bash
# Optional: Comma-separated list of channel name patterns to monitor
DISCORD_ALLOWED_CHANNELS=youtube,videos,media,links,general,notifications

# Optional: Comma-separated list of trusted bot names
DISCORD_TRUSTED_BOTS=NotifyMe,IFTTT,Zapier,YouTube,RSS
```

## Default Behavior
- **Trusted Bots**: NotifyMe, IFTTT, Zapier, YouTube, RSS
- **Allowed Channels**: Any channel containing: youtube, videos, media, links, general, notifications
- **Primary Channel**: Still processes `yt-uploads` (or configured upload channel)

## Testing
✅ NotifyMe bot messages will now be processed
✅ Maintains security by filtering unknown bots
✅ Flexible channel matching for various Discord setups
✅ Backward compatible with existing configurations

The NotifyMe bot should now work properly when posting YouTube links!
