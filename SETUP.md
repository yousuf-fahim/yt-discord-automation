# Setup Guide

This guide will walk you through the process of setting up the YouTube to Discord AI Automation Bot.

## Prerequisites

Before you begin, make sure you have the following:

1. Node.js (version 16.9.0 or higher)
2. A Discord account with permission to create a bot
3. An OpenAI API key
4. A Discord server where you have administrator permissions

## Step 1: Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give your application a name
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under the "Privileged Gateway Intents" section, enable:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
   - PRESENCE INTENT
5. Copy your bot token (you'll need this later)
6. Go to the "OAuth2" tab, then "URL Generator"
7. Select the following scopes:
   - bot
   - applications.commands
8. Select the following bot permissions:
   - Read Messages/View Channels
   - Send Messages
   - Manage Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Add Reactions
9. Copy the generated URL and open it in your browser to invite the bot to your server

## Step 2: Set Up Discord Channels

Create the following channels in your Discord server:

1. `#yt-uploads`: Where YouTube links will be posted
2. `#yt-transcripts`: Where transcripts will be stored (optional)
3. `#yt-summary-prompt-1`: Create at least one prompt channel with a pinned message containing your summarization prompt
4. `#yt-summaries-1`: Where summaries will be posted (corresponding to prompt-1)
5. `#yt-daily-report-prompt-1`: Create at least one daily report prompt channel with a pinned message
6. `#daily-report`: Where daily reports will be posted

You can create multiple prompt channels (e.g., `#yt-summary-prompt-2`, `#yt-summaries-2`) for different summarization styles.

## Step 3: Pin Prompts to Channels

1. In `#yt-summary-prompt-1`, post your summarization prompt and pin it:

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

2. In `#yt-daily-report-prompt-1`, post your daily report prompt and pin it:

```
Generate a comprehensive daily report summarizing all the YouTube videos processed today.
Group videos by topic or theme where appropriate.
Highlight the most important insights across all videos.
Format the report in Markdown with clear sections and bullet points.
```

## Step 4: Configure Environment Variables

1. Create a `.env` file in the project root:

```
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_server_id
DISCORD_YT_SUMMARIES_CHANNEL=yt-uploads
DISCORD_YT_TRANSCRIPTS_CHANNEL=yt-transcripts
DISCORD_DAILY_REPORT_CHANNEL=daily-report

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo

# Channel Prefix Configuration
SUMMARY_PROMPT_PREFIX=yt-summary-prompt-
SUMMARIES_OUTPUT_PREFIX=yt-summaries-
DAILY_REPORT_PROMPT_PREFIX=yt-daily-report-prompt-

# Daily Report Schedule (CEST)
DAILY_REPORT_HOUR=18
DAILY_REPORT_MINUTE=0

# Optional Configuration
CACHE_TRANSCRIPTS=true
DEBUG_MODE=true
```

Replace the placeholder values with your actual credentials:
- `your_discord_bot_token`: The token from Step 1
- `your_discord_server_id`: Your Discord server (guild) ID
- `your_openai_api_key`: Your OpenAI API key

## Step 5: Install Dependencies

Run the following command to install all required dependencies:

```bash
npm install
```

## Step 6: Run the Bot

Start the bot with:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

## Step 7: Test the Bot

1. Post a YouTube link in the `#yt-uploads` channel
2. The bot should:
   - React with 🔍 (searching)
   - Extract the transcript
   - React with ✅ (transcript found)
   - Generate summaries
   - Post the summaries to the appropriate channels
   - React with 📝 (completed)

## Step 8: Deployment (Optional)

### Vercel Deployment

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set up environment variables in the Vercel dashboard

### Heroku Deployment

1. Create a `Procfile` in the project root:
   ```
   web: node api/listener.js
   ```

2. Install Heroku CLI and deploy:
   ```bash
   heroku create
   git push heroku main
   ```

3. Set environment variables:
   ```bash
   heroku config:set DISCORD_BOT_TOKEN=your_token
   # Set other environment variables similarly
   ```

## Troubleshooting

If you encounter any issues, refer to the `TROUBLESHOOTING.md` file for solutions to common problems.
