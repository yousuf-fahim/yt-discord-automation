# Product Requirements Document (PRD)

**Project Title:** YouTube to Discord Automation System

**Author:** RubizCode  
**Date:** August 7, 2025

---

## 1. Overview

Build a fully automated system that tracks YouTube video links posted in a Discord channel, extracts their transcript using free tools, generates AI summaries using custom prompts, and posts the results to appropriate channels. It also generates a daily report of all summaries.

## 2. Objective

Streamline YouTube content digestion inside a Discord server by:

* Tracking YouTube links posted in `#yt-summaries`
* Extracting transcript via Tactiq (free)
* Summarizing via OpenAI using pinned prompt in `#yt-summary-prompt-*`
* Posting summary to `#yt-summaries-*`
* Generating a daily report at 18:00 CEST from that day's summaries using prompt in `#yt-daily-report-prompt-*`

## 3. Key Features

### A. Real-time Summary Generator

* **Trigger:** YouTube link detected in `#yt-summaries`
* **Steps:**
  1. Extract video ID from link
  2. Get transcript from Tactiq.io via Puppeteer
  3. Read pinned messages in all `#yt-summary-prompt-*` channels
  4. For each, call OpenAI API with transcript + prompt
  5. Post result to corresponding `#yt-summaries-*` channel

### B. Daily Report Generator

* **Schedule:** Every day at 18:00 CEST
* **Steps:**
  1. Gather all summaries generated that day
  2. Read pinned messages from all `#yt-daily-report-prompt-*` channels
  3. Use those prompts to generate report from summaries
  4. Post to `#daily-report`

## 4. Discord Channel Structure

* `#yt-summaries`: Raw video links posted manually or by NotifyMe
* `#yt-transcripts`: Stores raw transcript (optional)
* `#yt-summaries-1/2/3`: Summarized outputs using prompt 1/2/3
* `#yt-summary-prompt-1/2/3`: Pinned prompts for summary generation
* `#yt-daily-report-prompt-1/2/3`: Pinned prompts for report generation
* `#daily-report`: Final compiled report posted daily

## 5. Tech Stack

* **Language:** Node.js
* **Libraries:** discord.js, puppeteer, openai, dotenv, node-cron
* **Deployment:** Vercel (for scheduled functions) + Heroku (for Puppeteer headless)
* **Optional DB:** Supabase or local JSON file for caching transcripts and summaries

## 6. API Integrations

* **Tactiq.io Tool:** [https://tactiq.io/tools/youtube-transcript](https://tactiq.io/tools/youtube-transcript) (scraped)
* **OpenAI API:** For summarization & report generation
* **Discord API:** For listening & posting to channels

## 7. File & Folder Structure

```
yt-discord-automation/
├── api/
│   ├── listener.js
│   ├── summary.js
│   ├── transcript.js
│   └── report.js
├── prompts/
│   └── summary-1.md
├── utils/
│   ├── discord.js
│   ├── tactiq.js
│   ├── openai.js
│   └── scheduler.js
├── .env
└── vercel.json
```

## 8. Environment Variables

```
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_CHANNEL_IDS=yt-summaries,yt-transcripts,...
OPENAI_API_KEY=
```

## 9. Prompt Format (Example)

**Channel:** `#yt-summary-prompt-1`

```txt
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

## 10. Success Criteria

* Summaries are posted within 1 minute of video detection
* Daily reports are posted by 18:01 CEST
* Multiple prompt support works correctly (prompt-1/2/3)
* Prompt changes (via pin) reflect instantly without redeploy

## 11. Stretch Features

* Web dashboard to track processed videos
* Logging and retry queue for failures
* Analytics summary in weekly digest
