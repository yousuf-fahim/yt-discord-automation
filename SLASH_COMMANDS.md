# 🤖 Discord Slash Commands Reference

## Overview
The YouTube Discord Automation bot provides comprehensive slash commands for managing video processing, cache, reports, and system health. All commands provide rich embedded responses and detailed feedback.

---

## 🏥 **System Health & Monitoring**

### `/health`
**Description:** Check the health status of all bot services  
**Usage:** `/health`  
**Response:** Displays service status for:
- ✅/❌ Transcript Service (YouTube transcript extraction)
- ✅/❌ Report Service (Daily report generation)
- ✅/❌ Summary Service (OpenAI summarization) 
- ✅/❌ Discord Service (Bot connectivity)

---

### `/logs [lines]`
**Description:** Show recent bot activity logs  
**Usage:** `/logs` or `/logs lines:50`  
**Parameters:**
- `lines` (optional): Number of log lines to show (default: 10, max: 50)

**Response:** Recent bot activity including:
- Video processing events
- Error messages
- System status changes
- Command executions

---

### `/channel-status`
**Description:** Check which Discord channels are being monitored  
**Usage:** `/channel-status`  
**Response:** Shows status of all configured channels:
- Input channels (yt-summaries, yt-uploads)
- Output channels (yt-summaries-1/2/3)
- Report channels (daily-report, daily-report-2/3)
- Prompt channels (yt-summary-prompt-*, yt-daily-report-prompt-*)

---

## 📊 **Daily Reports**

### `/trigger-report [channel]`
**Description:** Manually trigger daily report generation  
**Usage:** `/trigger-report` or `/trigger-report channel:2`  
**Parameters:**
- `channel` (optional): Specific channel (1, 2, 3) or "all" for all channels

**Behavior:**
- **With summaries:** Generates report with processed videos
- **Without summaries:** Shows "No activity today" message
- **Never fails:** Always provides feedback

**Output Channels:**
- `channel:all` → All daily-report channels
- `channel:1` → daily-report 
- `channel:2` → daily-report-2
- `channel:3` → daily-report-3

---

## 🎥 **Video Processing**

### `/test-summary <video-url> [channel]`
**Description:** Process a single YouTube video immediately for testing  
**Usage:** `/test-summary video-url:https://youtube.com/watch?v=abc123`  
**Parameters:**
- `video-url` (required): Full YouTube URL
- `channel` (optional): Target summary channel (1, 2, 3, default: 1)

**Process Flow:**
1. Extracts video ID from URL
2. Fetches transcript via YouTube Transcript IO API
3. Gets video title
4. Applies channel-specific prompt
5. Generates summary via OpenAI
6. Posts to specified yt-summaries-X channel
7. Saves to cache for daily reports

---

### `/transcript-test <video-id>`
**Description:** Test transcript extraction for a specific video  
**Usage:** `/transcript-test video-id:dQw4w9WgXcQ`  
**Parameters:**
- `video-id` (required): YouTube video ID (11 characters)

**Response:** Shows:
- ✅/❌ Transcript extraction success
- Character count and language
- First 200 characters preview
- Error details if failed

---

## 💾 **Cache Management**

### `/cache-stats [cleanup]`
**Description:** View cache usage statistics and cleanup options  
**Usage:** `/cache-stats` or `/cache-stats cleanup:true`  
**Parameters:**
- `cleanup` (optional): Whether to perform cleanup (default: false)

**Response:** Shows:
- Total cache files and size
- Breakdown by type (transcripts, summaries, reports)
- Cache directory location
- Cleanup results if requested

---

### `/check-summaries [all-dates]`
**Description:** Check today's summaries and recent cache  
**Usage:** `/check-summaries` or `/check-summaries all-dates:true`  
**Parameters:**
- `all-dates` (optional): Show summaries from all dates (default: false)

**Response:** Shows:
- Today's summary count with titles
- Recent summaries (24 hours) count
- All dates with summary counts (if all-dates:true)
- Cache verification status

---

### `/debug-cache [pattern]`
**Description:** Debug cache contents and structure  
**Usage:** `/debug-cache` or `/debug-cache pattern:summaries`  
**Parameters:**
- `pattern` (optional): Filter cache files by pattern (e.g., "summaries", "transcript", "daily_report")

**Response:** Shows for each matching cache file:
- File name and type
- Data structure (Array/Object)
- Length/size information
- Content preview
- Error status if corrupted

---

### `/clear-cache <type> [date]`
**Description:** Clear cached summaries and reset reporting system  
**Usage:** `/clear-cache type:summaries` or `/clear-cache type:date date:2025-09-10`  
**Parameters:**
- `type` (required): What to clear
  - `summaries` - Clear all summary cache files
  - `reports` - Clear all report cache files
  - `all` - Clear everything (summaries + reports)
  - `date` - Clear specific date (requires date parameter)
- `date` (optional): Specific date in YYYY-MM-DD format

**⚠️ WARNING:** This resets your reporting system!
**Effect:**
- Clears selected cache files permanently
- Next reports will show "No activity" until new videos processed
- Cannot be undone

---

## ⚙️ **System Configuration**

### `/reload-prompts`
**Description:** Reload prompts from Discord pinned messages  
**Usage:** `/reload-prompts`  
**Process:**
- Scans all prompt channels (yt-summary-prompt-*, yt-daily-report-prompt-*)
- Fetches pinned messages
- Updates internal prompt cache
- Reports success/failure for each channel

---

### `/validate-prompts`
**Description:** Validate all prompt channels and check for issues  
**Usage:** `/validate-prompts`  
**Checks:**
- ✅/❌ Prompt channel exists
- ✅/❌ Has pinned messages
- ✅/❌ Pinned message content readable
- ✅/❌ Corresponding output channel exists

---

## 🎯 **Command Categories**

### **Essential Daily Use**
- `/health` - Quick system check
- `/trigger-report` - Manual report generation
- `/check-summaries` - Verify today's activity

### **Development & Testing**
- `/test-summary` - Test video processing
- `/transcript-test` - Test transcript extraction
- `/logs` - Debug issues

### **Maintenance & Troubleshooting**
- `/debug-cache` - Investigate cache issues
- `/clear-cache` - Reset system state
- `/validate-prompts` - Check configuration

### **Monitoring & Analytics**
- `/channel-status` - System overview
- `/cache-stats` - Storage usage
- `/reload-prompts` - Configuration refresh

---

## 🔐 **Permissions**
Currently, all commands are available to everyone in the server. Permission management will be added in future updates.

## 💡 **Tips**
- Use `/health` first when troubleshooting
- `/check-summaries` shows exactly what will be in reports
- `/clear-cache all` gives you a fresh start for testing
- Commands provide detailed error messages for troubleshooting
- All commands use Discord embeds for rich, formatted responses

## 🆘 **Common Issues**
- **Empty reports:** Run `/check-summaries` to verify cache
- **Command not working:** Check `/health` for service status
- **Old data showing:** Use `/clear-cache` to reset
- **Prompt issues:** Use `/validate-prompts` to check configuration
