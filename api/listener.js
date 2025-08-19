require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { extractVideoId, isYouTubeLink } = require('../utils/youtube');
const { getTranscript } = require('./transcript');
const { generateSummaries } = require('./summary');
const { setupDailyReport } = require('./report');

// Initialize Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Configuration
console.log('Environment variables:');
console.log('DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || 'NOT SET');
console.log('DISCORD_YT_SUMMARIES_CHANNEL:', process.env.DISCORD_YT_SUMMARIES_CHANNEL || 'NOT SET (will use default)');
console.log('DEBUG_MODE:', process.env.DEBUG_MODE || 'NOT SET (will use default)');

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const YT_SUMMARIES_CHANNEL = process.env.DISCORD_YT_SUMMARIES_CHANNEL || 'yt-uploads';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

// Bot ready event
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Set up daily report scheduler
  setupDailyReport(client);
  
  if (DEBUG_MODE) {
    console.log('Debug mode enabled');
  }
});

// Message handler
client.on('messageCreate', async (message) => {
  // ALWAYS log when ANY message is received for debugging
  console.log(`🔍 RECEIVED MESSAGE: "${message.content}" in channel: "${message.channel.name}" from: "${message.author.username}"`);
  console.log(`🔍 Guild: ${message.guild?.id}, Bot: ${message.author.bot}`);
  // Debug logging
  if (DEBUG_MODE) {
    console.log(`Message received in channel: ${message.channel.name}`);
    console.log(`Looking for channel: ${YT_SUMMARIES_CHANNEL}`);
    console.log(`Guild ID: ${message.guild?.id}`);
    console.log(`Expected Guild ID: ${GUILD_ID}`);
    console.log(`Message content: ${message.content}`);
  }
  
  // Special handling for NotifyMe app (which is a bot but we want to process its messages)
  const isNotifyMe = message.author.bot && 
                    (message.author.username === 'NotifyMe' || 
                     message.author.displayName === 'NotifyMe');
                     
  // Ignore other bot messages
  if (message.author.bot && !isNotifyMe) return;
  
  // Only process messages in the specified guild
  if (message.guild?.id !== GUILD_ID) return;
  
  // Check if message is in the YouTube summaries channel
  console.log(`Comparing channel names: "${message.channel.name}" vs "${YT_SUMMARIES_CHANNEL}"`);
  console.log(`Channel name match? ${message.channel.name === YT_SUMMARIES_CHANNEL}`);
  if (message.channel.name === YT_SUMMARIES_CHANNEL) {
    console.log(`Processing message in ${YT_SUMMARIES_CHANNEL} channel`);
    // Process YouTube links
    const content = message.content;
    
    // For NotifyMe messages, we need to check embeds as well
    let youtubeLink = content;
    let foundYouTubeLink = isYouTubeLink(content);
    
    // If it's a NotifyMe message and no YouTube link in content, check embeds
    if (isNotifyMe && !foundYouTubeLink && message.embeds && message.embeds.length > 0) {
      console.log('Checking NotifyMe embeds for YouTube links');
      
      for (const embed of message.embeds) {
        // Check embed URL
        if (embed.url && isYouTubeLink(embed.url)) {
          youtubeLink = embed.url;
          foundYouTubeLink = true;
          console.log('Found YouTube link in embed URL:', youtubeLink);
          break;
        }
        
        // Check embed description
        if (embed.description && isYouTubeLink(embed.description)) {
          youtubeLink = embed.description;
          foundYouTubeLink = true;
          console.log('Found YouTube link in embed description:', youtubeLink);
          break;
        }
        
        // Check fields
        if (embed.fields && embed.fields.length > 0) {
          for (const field of embed.fields) {
            if (field.value && isYouTubeLink(field.value)) {
              youtubeLink = field.value;
              foundYouTubeLink = true;
              console.log('Found YouTube link in embed field:', youtubeLink);
              break;
            }
          }
          if (foundYouTubeLink) break;
        }
      }
    }
    
    if (foundYouTubeLink) {
      try {
        // Extract video ID
        const videoId = extractVideoId(youtubeLink);
        if (!videoId) {
          console.error('Could not extract video ID from link:', youtubeLink);
          return;
        }
        
        // Send acknowledgment
        await message.react('🔍');
        
        // Get transcript
        console.log(`Getting transcript for video ID: ${videoId}`);
        const transcript = await getTranscript(videoId);
        
        if (!transcript) {
          console.error('Failed to get transcript for video ID:', videoId);
          await message.react('❌');
          return;
        }
        
        // Generate and post summaries
        await message.react('✅');
        await message.react('🤖');
        
        try {
          await generateSummaries(client, videoId, transcript, content);
          // Final confirmation
          await message.reactions.cache.get('🤖')?.remove().catch(err => console.error('Error removing reaction:', err));
          await message.react('📝');
        } catch (summaryError) {
          console.error('Error generating summaries:', summaryError);
          await message.reactions.cache.get('🤖')?.remove().catch(() => {});
          await message.react('⚠️');
          
          // Send error message back to the channel
          await message.reply({
            content: `⚠️ Failed to generate summary for this video. Error: ${summaryError.message || 'Unknown error'}`,
            flags: ['SuppressNotifications']
          }).catch(err => console.error('Error sending error message:', err));
        }
      } catch (error) {
        console.error('Error processing YouTube link:', error);
        await message.react('❌');
      }
    }
  }
});

// Error handling
client.on('error', console.error);

// Login to Discord with increased timeout and retry
const MAX_LOGIN_ATTEMPTS = 3;
let loginAttempts = 0;

async function attemptLogin() {
  try {
    loginAttempts++;
    console.log(`Attempting to log in to Discord (attempt ${loginAttempts}/${MAX_LOGIN_ATTEMPTS})...`);
    
    // Login with increased timeout
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('Successfully logged in to Discord!');
  } catch (error) {
    console.error(`Login attempt ${loginAttempts} failed:`, error);
    
    if (loginAttempts < MAX_LOGIN_ATTEMPTS) {
      console.log(`Retrying in 10 seconds...`);
      setTimeout(attemptLogin, 10000); // 10 second delay between attempts
    } else {
      console.error('All login attempts failed. Please check your network connection and bot token.');
      console.error('Tips: 1. Verify your DISCORD_BOT_TOKEN is correct');
      console.error('      2. Check if you can reach discord.com (ping discord.com)');
      console.error('      3. Try using a VPN if you\'re on a restricted network');
      process.exit(1);
    }
  }
}

// Start login process
attemptLogin();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Bot shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Bot shutting down...');
  client.destroy();
  process.exit(0);
});

module.exports = client;
