/**
 * Discord Service - Discord bot management and message handling
 */

const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

class DiscordService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.transcript = dependencies.transcript;
    this.summary = dependencies.summary;
    this.report = dependencies.report;
    this.logger = serviceManager.logger;
    this.config = serviceManager.config.discord;
    
    // Track processed messages to prevent duplicates
    this.processedMessages = new Set();
    
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    this.setupEventHandlers();
    
    // Clean up processed messages every hour to prevent memory leaks
    setInterval(() => {
      this.cleanupProcessedMessages();
    }, 60 * 60 * 1000); // 1 hour
  }
  
  cleanupProcessedMessages() {
    // Keep only messages from the last 2 hours (arbitrary retention period)
    // In a production environment, you might want to use a more sophisticated approach
    if (this.processedMessages.size > 1000) {
      this.processedMessages.clear();
      this.logger.debug('Cleared processed messages cache');
    }
  }

  async initialize() {
    this.logger.info('Discord service initialized');
  }

  setupEventHandlers() {
    this.client.once('ready', () => {
      this.logger.info(`Discord bot logged in as ${this.client.user.tag}`);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      try {
        await this.handleMessage(message);
      } catch (error) {
        this.logger.error('Message handling error', error);
      }
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error', error);
    });
  }

  async handleMessage(message) {
    // Prevent duplicate processing of the same message
    if (this.processedMessages.has(message.id)) {
      this.logger.debug(`Skipping already processed message: ${message.id}`);
      return;
    }
    
    // Check if message contains YouTube link
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = message.content.match(youtubeRegex);
    
    if (match) {
      const videoId = match[1];
      const channelName = message.channel.name;
      
      // Mark message as being processed
      this.processedMessages.add(message.id);
      
      this.logger.info(`Processing YouTube video: ${videoId} in channel: ${channelName}`);
      
      // Only process videos in yt-uploads channel
      if (!channelName || !channelName.includes(this.config.channels.uploads)) {
        this.logger.info(`Ignoring video in non-upload channel: ${channelName}`);
        return;
      }
      
      try {
        // Add processing reaction
        await message.react('🤖');
        
        // Get transcript
        const transcript = await this.transcript.getTranscript(videoId);
        if (!transcript) {
          await message.react('❌');
          await message.reply('Sorry, I could not extract the transcript for this video.');
          return;
        }

        // Get video title (try to extract from message or use video ID)
        const videoTitle = await this.getVideoTitle(videoId, message.content);
        
        // 1. Send transcript file to yt-transcripts channel
        await this.sendTranscriptFile(message.guild, videoId, videoTitle, transcript);
        
        // 2. Generate and send summaries to summary channels
        await this.processSummaryChannels(message.guild, videoId, videoTitle, transcript, message.content);
        
        await message.react('✅');
        
      } catch (error) {
        this.logger.error('Video processing error', error);
        await message.react('⚠️');
        await message.reply('Sorry, there was an error processing this video.');
      }
    }
  }

  extractTitleFromMessage(content) {
    // Try to extract a title from the message content (line without YouTube URL)
    if (!content) return null;
    
    const lines = content.split('\n');
    const titleLine = lines.find(line => {
      const trimmed = line.trim();
      return trimmed && 
             trimmed.length > 3 && // Must be meaningful length
             !trimmed.includes('youtube.com') && 
             !trimmed.includes('youtu.be') &&
             !trimmed.match(/^[-\s]*$/) && // Not just dashes/spaces
             !trimmed.match(/^[#@<>]*$/) // Not just symbols
    });
    
    return titleLine ? titleLine.trim() : null;
  }

  async getVideoTitle(videoId, messageContent) {
    try {
      console.log(`🎯 Getting title for video ${videoId}`);
      console.log(`📝 Message content: "${messageContent}"`);
      
      // First try to get title from YouTube Transcript IO API (most reliable)
      try {
        const transcriptService = this.serviceManager.getService('transcript');
        if (transcriptService && transcriptService.transcriptIO) {
          const apiTitle = await transcriptService.transcriptIO.getVideoTitle(videoId);
          console.log(`🎬 Transcript API title result: "${apiTitle}"`);
          if (apiTitle) {
            const sanitized = this.sanitizeFilename(apiTitle);
            console.log(`✅ Using Transcript API title: "${sanitized}"`);
            return sanitized;
          }
        }
      } catch (error) {
        console.log(`⚠️ Transcript API title failed: ${error.message}`);
      }
      
      // Fallback to page scraping
      console.log(`🔄 Falling back to page scraping...`);
      const { getYouTubeTitle } = require('../../utils/youtube-title');
      const scrapedTitle = await getYouTubeTitle(videoId);
      console.log(`🔍 Scraped title result: "${scrapedTitle}"`);
      if (scrapedTitle) {
        const sanitized = this.sanitizeFilename(scrapedTitle);
        console.log(`✅ Using scraped title: "${sanitized}"`);
        return sanitized;
      }
      
      // Fallback to extracting from message
      console.log(`🔄 Falling back to message extraction...`);
      const extractedTitle = this.extractTitleFromMessage(messageContent);
      console.log(`📑 Extracted from message: "${extractedTitle}"`);
      if (extractedTitle) {
        const sanitized = this.sanitizeFilename(extractedTitle);
        console.log(`✅ Using extracted title: "${sanitized}"`);
        return sanitized;
      }
      
      // Final fallback to video ID
      console.log(`⚠️ Using video ID fallback for ${videoId}`);
      this.logger.info(`Using fallback title for ${videoId}`);
      return `YouTube_Video_${videoId}`;
    } catch (error) {
      console.log(`❌ Error in getVideoTitle: ${error.message}`);
      this.logger.error('Error getting video title', error);
      return `YouTube_Video_${videoId}`;
    }
  }

  extractVideoUrl(messageContent) {
    const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = messageContent.match(youtubeRegex);
    return match ? match[0] : null;
  }

  sanitizeFilename(title) {
    // Remove invalid characters for filenames
    return title
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 100) // Limit length
      .trim();
  }

  async sendTranscriptFile(guild, videoId, videoTitle, transcript) {
    try {
      // Use the configured guild, not the message guild
      const targetGuild = this.client.guilds.cache.get(this.config.guildId);
      if (!targetGuild) {
        throw new Error(`Guild with ID ${this.config.guildId} not found`);
      }

      const transcriptChannel = targetGuild.channels.cache.find(
        channel => channel.name && channel.name.includes(this.config.channels.transcripts)
      );

      if (!transcriptChannel) {
        this.logger.warn('yt-transcripts channel not found');
        return;
      }

      // Create transcript file content
      const fileContent = `# YouTube Video Transcript
# Video ID: ${videoId}
# Title: ${videoTitle}
# Generated: ${new Date().toISOString()}

${transcript}`;

      // Create file buffer
      const buffer = Buffer.from(fileContent, 'utf8');
      const filename = `${videoTitle}.txt`;

      // Send file without extra headers
      await transcriptChannel.send({
        files: [{
          attachment: buffer,
          name: filename
        }]
      });

      this.logger.info(`Transcript file sent: ${filename}`);
    } catch (error) {
      this.logger.error('Error sending transcript file', error);
    }
  }

  async processSummaryChannels(guild, videoId, videoTitle, transcript, originalMessage) {
    try {
      // Use the configured guild, not the message guild
      const targetGuild = this.client.guilds.cache.get(this.config.guildId);
      if (!targetGuild) {
        throw new Error(`Guild with ID ${this.config.guildId} not found`);
      }

      // Find all summary channels that have corresponding prompt channels
      const summaryChannels = targetGuild.channels.cache.filter(
        channel => channel.name && channel.name.includes(this.config.prefixes.summariesOutput)
      );

      if (summaryChannels.size === 0) {
        this.logger.warn('No yt-summaries channels found');
        return;
      }

      // Process each summary channel only if it has a corresponding prompt channel with content
      for (const [channelId, channel] of summaryChannels) {
        try {
          // Extract the number from the summary channel (e.g., yt-summaries-1 -> 1)
          const channelNumber = channel.name.replace(this.config.prefixes.summariesOutput, '');
          if (!channelNumber || !/^\d+$/.test(channelNumber)) continue;
          
          // Find corresponding prompt channel
          const promptChannelName = `${this.config.prefixes.summaryPrompt}${channelNumber}`;
          const promptChannel = targetGuild.channels.cache.find(
            ch => ch.name === promptChannelName
          );
          
          if (!promptChannel) {
            this.logger.info(`No prompt channel found for ${channel.name}, skipping`);
            continue;
          }
          
          // Check if prompt channel has pinned messages
          const pinnedMessages = await promptChannel.messages.fetchPinned();
          this.logger.info(`Channel ${promptChannelName} has ${pinnedMessages.size} pinned messages`);
          if (pinnedMessages.size === 0) {
            this.logger.info(`No pinned messages in ${promptChannelName}, skipping ${channel.name}`);
            continue;
          }
          
          await this.processSingleSummaryChannel(channel, videoId, videoTitle, transcript, originalMessage, promptChannel);
        } catch (error) {
          this.logger.error(`Error processing summary channel ${channel.name}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error processing summary channels', error);
    }
  }

  async processSingleSummaryChannel(channel, videoId, videoTitle, transcript, originalMessage, promptChannel) {
    try {
      // Get pinned messages from the prompt channel
      const pinnedMessages = await promptChannel.messages.fetchPinned();
      
      if (pinnedMessages.size === 0) {
        this.logger.warn(`No pinned messages in ${promptChannel.name}`);
        return;
      }

      // Use the first pinned message as the prompt
      const pinnedMessage = pinnedMessages.first();
      const customPrompt = pinnedMessage.content;
      this.logger.info(`Using custom prompt from ${promptChannel.name}`);

      // Generate summary with custom prompt
      const summary = await this.summary.generateSummary(transcript, videoTitle, originalMessage, customPrompt);
      
      // Save summary for daily report
      const videoUrl = this.extractVideoUrl(originalMessage);
      await this.report.saveSummary(videoId, videoTitle, summary, videoUrl);
      
      // Send summary to the channel without extra headers
      await this.sendLongMessage(channel, summary);
      
      this.logger.info(`Summary sent to ${channel.name}`);
    } catch (error) {
      this.logger.error(`Error in summary channel ${channel.name}`, error);
    }
  }

  async sendLongMessage(target, content, maxLength = 1900) {
    // Split long messages to avoid Discord's 2000 character limit
    // Using 1900 to leave some buffer for formatting
    // target can be a message (for replies) or a channel (for direct sends)
    
    if (content.length <= maxLength) {
      if (target.reply) {
        await target.reply(content);
      } else {
        await target.send(content);
      }
      return;
    }

    // Split content into chunks
    const chunks = [];
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      // If adding this line would exceed the limit
      if ((currentChunk + '\n' + line).length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = line;
        } else {
          // Single line is too long, split it
          const words = line.split(' ');
          let wordChunk = '';
          for (const word of words) {
            if ((wordChunk + ' ' + word).length > maxLength) {
              if (wordChunk) {
                chunks.push(wordChunk.trim());
                wordChunk = word;
              } else {
                // Single word is too long, truncate it
                chunks.push(word.substring(0, maxLength - 3) + '...');
                wordChunk = '';
              }
            } else {
              wordChunk += (wordChunk ? ' ' : '') + word;
            }
          }
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    // Send chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = i === 0 ? chunks[i] : `**Continued...**\n\n${chunks[i]}`;
      
      if (target.reply && i === 0) {
        await target.reply(chunkContent);
      } else if (target.channel) {
        await target.channel.send(chunkContent);
      } else {
        await target.send(chunkContent);
      }
      
      // Small delay between messages to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  async start() {
    if (!this.config.token) {
      throw new Error('Discord bot token not configured');
    }
    
    await this.client.login(this.config.token);
    
    // Setup daily report scheduling once bot is ready
    this.client.once('ready', () => {
      this.setupDailyReportSchedule();
    });
  }

  setupDailyReportSchedule() {
    // Use configured schedule from environment
    const reportHour = this.config.schedule.dailyReportHour;
    const reportMinute = this.config.schedule.dailyReportMinute;
    
    // Convert CEST to UTC for cron
    const now = new Date();
    const isDST = () => {
      const jan = new Date(now.getFullYear(), 0, 1);
      const jul = new Date(now.getFullYear(), 6, 1);
      return now.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    };
    
    const utcOffset = isDST() ? 2 : 1; // CEST = UTC+2, CET = UTC+1
    const utcHour = (reportHour - utcOffset + 24) % 24;
    const cronExpression = `${reportMinute} ${utcHour} * * *`;
    
    this.logger.info(`Setting up daily report scheduler: ${cronExpression} (${reportHour}:${reportMinute.toString().padStart(2, '0')} CEST)`);
    
    // Schedule daily report
    cron.schedule(cronExpression, async () => {
      this.logger.info('Running scheduled daily report...');
      try {
        await this.report.sendDailyReport(this);
      } catch (error) {
        this.logger.error('Scheduled daily report failed', error);
      }
    });
  }

  async sendDailyReport(report) {
    try {
      // Find the configured guild
      const guild = this.client.guilds.cache.get(this.config.guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${this.config.guildId} not found`);
      }
      
      // Check for daily report prompt channels
      const dailyReportPromptChannels = guild.channels.cache.filter(
        channel => channel.name && channel.name.startsWith(this.config.prefixes.dailyReportPrompt)
      );
      
      if (dailyReportPromptChannels.size > 0) {
        // Process each daily report prompt channel
        for (const [channelId, promptChannel] of dailyReportPromptChannels) {
          await this.processDailyReportWithPrompt(guild, promptChannel, report);
        }
      } else {
        // Fallback to default daily report
        await this.sendDefaultDailyReport(guild, report);
      }
      
      this.logger.info('Daily report processing completed');
    } catch (error) {
      this.logger.error('Error sending daily report', error);
      throw error;
    }
  }

  async processDailyReportWithPrompt(guild, promptChannel, defaultReport) {
    try {
      // Get pinned messages from the prompt channel
      const pinnedMessages = await promptChannel.messages.fetchPinned();
      
      if (pinnedMessages.size === 0) {
        this.logger.info(`No pinned messages in ${promptChannel.name}, skipping custom daily report`);
        return;
      }

      // Use the first pinned message as the prompt
      const pinnedMessage = pinnedMessages.first();
      const customPrompt = pinnedMessage.content;
      this.logger.info(`Using custom daily report prompt from ${promptChannel.name}`);

      // Get recent summaries for custom processing
      const summaries = await this.report.getRecentSummaries();
      
      // Generate custom daily report using OpenAI
      const customReport = await this.generateCustomDailyReport(summaries, customPrompt);
      
      // Find corresponding output channel (remove 'prompt-' from name)
      const outputChannelName = promptChannel.name.replace(this.config.prefixes.dailyReportPrompt, 'daily-report-');
      let outputChannel = guild.channels.cache.find(ch => ch.name === outputChannelName);
      
      if (!outputChannel) {
        // Fallback to default daily-report channel
        outputChannel = guild.channels.cache.find(
          channel => channel.name && channel.name.includes(this.config.channels.dailyReport)
        );
      }
      
      if (!outputChannel) {
        // Last resort fallback
        outputChannel = guild.channels.cache.find(
          channel => channel.name && (
            channel.name.includes('general') || 
            channel.name.includes('bot') ||
            channel.name.includes('yt-summaries')
          )
        );
      }
      
      if (outputChannel) {
        this.logger.info(`Sending custom daily report to channel: ${outputChannel.name}`);
        await this.sendLongMessage(outputChannel, customReport);
        this.logger.info(`Custom daily report sent to ${outputChannel.name}`);
      } else {
        this.logger.error('No suitable output channel found for custom daily report');
      }
    } catch (error) {
      this.logger.error(`Error processing daily report prompt from ${promptChannel.name}`, error);
    }
  }

  async generateCustomDailyReport(summaries, customPrompt) {
    try {
      // Prepare summaries data for the prompt
      const summariesData = summaries.map(summary => ({
        title: summary.title,
        content: summary.content,
        url: summary.url,
        timestamp: summary.timestamp
      }));

      const summariesText = summariesData.map((summary, index) => 
        `${index + 1}. ${summary.title}\nContent: ${summary.content}\nURL: ${summary.url}\nTime: ${new Date(summary.timestamp).toLocaleString()}\n`
      ).join('\n');

      // Generate custom report using summary service
      const prompt = `${customPrompt}\n\nRecent YouTube Video Summaries (Last 24 hours):\n${summariesText}`;
      
      return await this.summary.generateSummary(summariesText, 'Daily Report', '', prompt);
    } catch (error) {
      this.logger.error('Error generating custom daily report', error);
      // Fallback to default report format
      return this.report.buildReport(summaries);
    }
  }

  async sendDefaultDailyReport(guild, report) {
    try {
      let reportChannel = guild.channels.cache.find(
        channel => channel.name && channel.name.includes(this.config.channels.dailyReport)
      );
      
      if (!reportChannel) {
        this.logger.warn('daily-report channel not found, looking for alternatives...');
        
        // Try to find general or bot channel as fallback
        reportChannel = guild.channels.cache.find(
          channel => channel.name && (
            channel.name.includes('general') || 
            channel.name.includes('bot') ||
            channel.name.includes('yt-summaries')
          )
        );
      }
      
      if (!reportChannel) {
        this.logger.error('No suitable channel found for daily report');
        return;
      }
      
      this.logger.info(`Sending default daily report to channel: ${reportChannel.name}`);
      await this.sendLongMessage(reportChannel, report);
      this.logger.info('Default daily report sent to channel');
    } catch (error) {
      this.logger.error('Error sending default daily report', error);
      throw error;
    }
  }

  async shutdown() {
    if (this.client) {
      this.client.destroy();
      this.logger.info('Discord service shut down');
    }
  }

  async healthCheck() {
    return {
      status: this.client.isReady() ? 'ok' : 'disconnected',
      uptime: this.client.uptime,
      ping: this.client.ws.ping,
      guilds: this.client.guilds.cache.size
    };
  }
}

module.exports = DiscordService;
