/**
 * Manual trigger script for YouTube to Discord bot
 * 
 * This script allows manually triggering summary generation or daily report generation
 * for testing purposes.
 * 
 * Usage:
 *   node api/manual-trigger.js summary <videoId>
 *   node api/manual-trigger.js report
 */

require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const { getTranscript } = require('./transcript');
const { generateSummaries } = require('./summary');
const { generateDailyReports } = require('./report');
const { getYouTubeUrl } = require('../utils/youtube');

// Initialize Discord client with necessary intents
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const videoId = args[1];

// Main function to handle different commands
async function main() {
  if (!command) {
    console.error('Please provide a command: "summary" or "report"');
    console.error('Usage:');
    console.error('  node api/manual-trigger.js summary <videoId>');
    console.error('  node api/manual-trigger.js report');
    process.exit(1);
  }

  try {
    // Login to Discord
    console.log('Logging in to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('Logged in successfully as', client.user.tag);

    // Wait for client to be ready
    await new Promise(resolve => {
      if (client.isReady()) resolve();
      else client.once('ready', resolve);
    });

    // Handle different commands
    switch (command.toLowerCase()) {
      case 'summary':
        await handleSummaryCommand(videoId);
        break;
      case 'report':
        await handleReportCommand();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Please use "summary" or "report"');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always destroy the client when done
    client.destroy();
    console.log('Discord client destroyed');
  }
}

// Handle summary command
async function handleSummaryCommand(videoId) {
  if (!videoId) {
    console.error('Please provide a YouTube video ID');
    console.error('Usage: node api/manual-trigger.js summary <videoId>');
    process.exit(1);
  }

  console.log(`Generating summary for video ID: ${videoId}`);
  console.log(`Video URL: ${getYouTubeUrl(videoId)}`);

  // Get transcript
  const transcript = await getTranscript(videoId);
  if (!transcript) {
    console.error('Failed to get transcript');
    process.exit(1);
  }

  console.log(`Got transcript (${transcript.length} characters)`);
  
  // Generate summaries
  await generateSummaries(client, videoId, transcript, getYouTubeUrl(videoId));
  console.log('Summary generation complete');
}

// Handle report command
async function handleReportCommand() {
  console.log('Generating daily report...');
  await generateDailyReports(client, true); // Force generation even if no summaries for today
  console.log('Daily report generation complete');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});