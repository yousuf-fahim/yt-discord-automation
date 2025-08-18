# Heroku Production Fix for yt-dlp Issues

## Problem
The bot was working locally but failing in Heroku production with yt-dlp command failures:
```
Command failed: yt-dlp --no-download --get-title ...
All 3 verification attempts failed
Video is unavailable
```

## Root Cause
yt-dlp wasn't properly installed or accessible in the Heroku environment.

## Fixes Applied

### 1. Enhanced post_compile Script
Updated `/bin/post_compile` to:
- Use multiple installation methods for yt-dlp
- Set proper PATH variables
- Create symlinks if needed
- Better error detection and logging
- Install with both system and user flags

### 2. Dynamic yt-dlp Detection
Updated `api/transcript.js` to:
- Auto-detect working yt-dlp command at startup
- Try multiple possible paths: `yt-dlp`, `/app/.heroku/python/bin/yt-dlp`, `~/.local/bin/yt-dlp`, `python3 -m yt_dlp`
- Wait for detection to complete before processing
- Use detected command in all yt-dlp operations

### 3. Updated Python Requirements
- Updated `requirements.txt` to use `yt-dlp>=2024.08.06` (more recent version)

### 4. Better Error Handling
- Added timeout mechanism for yt-dlp detection
- Fallback to default command if detection fails
- Enhanced logging for troubleshooting

## Testing Tools

### Local Testing
```bash
node test-yt-dlp-setup.js
```

### Production Testing
After deployment, check Heroku logs for:
```
✅ Using yt-dlp command: [detected_command]
```

## Deployment Steps

1. **Commit the changes:**
```bash
git add .
git commit -m "Fix yt-dlp installation and detection for Heroku"
```

2. **Deploy to Heroku:**
```bash
git push heroku main
```

3. **Monitor deployment logs:**
```bash
heroku logs --tail
```

4. **Look for successful yt-dlp detection:**
```
✅ Using yt-dlp command: python3 -m yt_dlp
```

5. **Test with a manual trigger:**
Use Discord to test with a YouTube link or use the manual trigger:
```bash
heroku run node api/manual-trigger.js summary dQw4w9WgXcQ
```

## Expected Results

### Before Fix:
```
Attempt 1 failed: Command failed: yt-dlp --no-download --get-title ...
All 3 verification attempts failed
Video is unavailable
```

### After Fix:
```
✅ Using yt-dlp command: python3 -m yt_dlp
Processing message in yt-uploads channel
Getting transcript for video ID: cXu8sTUSTsE
Video title found: [Actual Video Title]
```

## Troubleshooting

If issues persist:

1. **Check yt-dlp installation in Heroku:**
```bash
heroku run node test-yt-dlp-setup.js
```

2. **Verify buildpacks:**
```bash
heroku buildpacks
```
Should include both `heroku/nodejs` and `heroku/python`.

3. **Check Python availability:**
```bash
heroku run python3 --version
heroku run pip3 list | grep yt-dlp
```

4. **Manual yt-dlp test:**
```bash
heroku run python3 -m yt_dlp --version
```

## Backup Solutions

If the main fix doesn't work, alternative approaches:
1. Use the Docker buildpack with a custom Dockerfile
2. Switch to a different transcript extraction service
3. Use the YouTube API with purchased quota (requires API key)

---
**Status:** ✅ Ready for deployment
**Priority:** High - Blocks transcript generation in production
