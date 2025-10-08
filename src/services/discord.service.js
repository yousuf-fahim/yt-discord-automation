/**
 * Discord Service - Discord bot management and message handling
 */

const { Client, GatewayIntentBits, Events, REST, Routes, AttachmentBuilder } = require('discord.js');
const cron = require('node-cron');
const CommandService = require('./command.service');

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

    // Initialize command service
    this.commandService = null;
    
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
    try {
      console.log('🤖 Initializing Discord service...');
      
      await this.client.login(this.config.token);
      
      console.log('✅ Discord service initialized');
      
      // Schedule reports generation
      this.scheduleReports();
      
      // Note: Slash commands are registered in the 'ready' event handler
      
    } catch (error) {
      console.error('❌ Failed to initialize Discord service:', error);
      throw error;
    }
  }

  async initializeCommands() {
    try {
      console.log('🤖 Setting up Discord slash commands...');
      
      // Wait for client to be ready
      if (!this.client.isReady()) {
        await new Promise(resolve => this.client.once('ready', resolve));
      }
      
      // Initialize command service
      this.commandService = new CommandService(this.serviceManager, {
        discord: this,
        logger: console
      });
      
      // Register slash commands with Discord
      const rest = new REST({ version: '10' }).setToken(this.config.token);
      
      const commands = this.commandService.getCommandData();
      
      await rest.put(
        Routes.applicationGuildCommands(this.client.user.id, this.config.guildId),
        { body: commands }
      );
      
      console.log(`✅ Successfully registered ${commands.length} slash commands`);
      
    } catch (error) {
      console.error('❌ Failed to register slash commands:', error);
      // Don't throw here - commands are optional, bot can still work
    }
  }

  setupEventHandlers() {
    this.client.once('ready', async () => {
      this.logger.info(`Discord bot logged in as ${this.client.user.tag}`);
      
      // Register slash commands after client is ready
      await this.initializeCommands();
    });

    this.client.on('messageCreate', async (message) => {
      // Skip messages from our own bot to prevent loops
      if (message.author.id === this.client.user?.id) return;
      
      // For bot messages, check if it's a trusted bot
      if (message.author.bot && !this.isTrustedBot(message.author)) {
        this.logger.debug(`Ignoring message from untrusted bot: ${message.author.username}`);
        return;
      }
      
      try {
        await this.handleMessage(message);
      } catch (error) {
        this.logger.error('Message handling error', error);
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      console.log(`🔍 Received interaction: ${interaction.type} - Command: ${interaction.commandName}`);
      
      if (!interaction.isChatInputCommand()) return;
      
      try {
        if (this.commandService) {
          console.log(`✅ Command service available, handling: ${interaction.commandName}`);
          await this.commandService.handleCommand(interaction);
        } else {
          console.log('❌ Command service not available');
          await interaction.reply('❌ Command service not available');
        }
      } catch (error) {
        console.error('Command interaction error:', error);
        
        const errorMessage = '❌ There was an error executing this command!';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error', error);
    });
  }

  /**
   * Check if a bot user is in the trusted bots list
   * @param {import('discord.js').User} botUser - The bot user to check
   * @returns {boolean} - Whether the bot is trusted
   */
  isTrustedBot(botUser) {
    if (!botUser.bot) return true; // Not a bot, so it's allowed
    
    const trustedBots = this.config.trustedBots || ['NotifyMe', 'IFTTT', 'Zapier', 'YouTube', 'RSS'];
    const botName = botUser.username || botUser.displayName || '';
    
    // Check exact match or partial match (case insensitive)
    return trustedBots.some(trusted => 
      botName.toLowerCase().includes(trusted.toLowerCase()) ||
      trusted.toLowerCase().includes(botName.toLowerCase())
    );
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
      const authorInfo = message.author.bot ? `Bot: ${message.author.username}` : `User: ${message.author.username}`;
      
      this.logger.info(`Found YouTube link in message from ${authorInfo} in channel: ${channelName}`);
      
      // Mark message as being processed
      this.processedMessages.add(message.id);
      
      this.logger.info(`Processing YouTube video: ${videoId} in channel: ${channelName}`);
      
      // Check if we should process this channel
      const shouldProcess = this.shouldProcessChannel(channelName);
      if (!shouldProcess) {
        this.logger.info(`Ignoring video in non-monitored channel: ${channelName}`);
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

        // Add reaction for successful transcript extraction
        await message.react('🗒️');

        // Get video title (try to extract from message or use video ID)
        const videoTitle = await this.getVideoTitle(videoId, message.content);
        
        // 1. Send transcript file to yt-transcripts channel
        await this.sendTranscriptFile(message.guild, videoId, videoTitle, transcript);
        
        // 2. Generate and send summaries to summary channels
        await this.processSummaryChannels(message.guild, videoId, videoTitle, transcript, message.content);
        
        // Add reaction for successful summary execution
        await message.react('✅');
        
      } catch (error) {
        this.logger.error('Video processing error', error);
        await message.react('⚠️');
        await message.reply('Sorry, there was an error processing this video.');
      }
    }
  }

  /**
   * Determine if a channel should be processed for YouTube links
   * @param {string} channelName - The name of the channel
   * @returns {boolean} - Whether to process this channel
   */
  shouldProcessChannel(channelName) {
    if (!channelName) return false;
    
    // Primary channel (exact match or contains)
    if (channelName.includes(this.config.channels.uploads)) {
      return true;
    }
    
    // Use configured allowed patterns or defaults
    const allowedPatterns = this.config.allowedChannelPatterns || [
      'youtube',
      'videos', 
      'media', 
      'links',
      'general',
      'bot-spam',
      'feeds',
      'notifications'
    ];
    
    const lowerChannelName = channelName.toLowerCase();
    return allowedPatterns.some(pattern => lowerChannelName.includes(pattern));
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
      
      // First try direct YouTube Transcript IO API (most reliable)
      try {
        if (process.env.YOUTUBE_TRANSCRIPT_IO_TOKEN) {
          console.log(`🔄 Trying direct YouTube Transcript IO API...`);
          const YouTubeTranscriptIOService = require('./youtube-transcript-io.service');
          const ioService = new YouTubeTranscriptIOService();
          const apiTitle = await ioService.getVideoTitle(videoId);
          console.log(`🎬 Direct Transcript API title result: "${apiTitle}"`);
          if (apiTitle && apiTitle.length > 3) {
            const sanitized = this.sanitizeFilename(apiTitle);
            if (sanitized) {
              console.log(`✅ Using Direct Transcript API title: "${sanitized}"`);
              return sanitized;
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Direct Transcript API title failed: ${error.message}`);
      }
      
      // Try via service manager (fallback)
      try {
        const transcriptService = this.serviceManager.getService('transcript');
        if (transcriptService && transcriptService.transcriptIO) {
          const apiTitle = await transcriptService.transcriptIO.getVideoTitle(videoId);
          console.log(`🎬 Service Manager Transcript API title result: "${apiTitle}"`);
          if (apiTitle && apiTitle.length > 3) {
            const sanitized = this.sanitizeFilename(apiTitle);
            if (sanitized) {
              console.log(`✅ Using Service Manager Transcript API title: "${sanitized}"`);
              return sanitized;
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Service Manager Transcript API title failed: ${error.message}`);
      }
      
      // Fallback to page scraping
      console.log(`🔄 Falling back to page scraping...`);
      const { getYouTubeTitle } = require('../../utils/youtube-title');
      const scrapedTitle = await getYouTubeTitle(videoId);
      console.log(`🔍 Scraped title result: "${scrapedTitle}"`);
      if (scrapedTitle && scrapedTitle.length > 3) {
        const sanitized = this.sanitizeFilename(scrapedTitle);
        if (sanitized) {
          console.log(`✅ Using scraped title: "${sanitized}"`);
          return sanitized;
        }
      }
      
      // Fallback to extracting from message
      console.log(`🔄 Falling back to message extraction...`);
      const extractedTitle = this.extractTitleFromMessage(messageContent);
      console.log(`📑 Extracted from message: "${extractedTitle}"`);
      if (extractedTitle && extractedTitle.length > 3) {
        const sanitized = this.sanitizeFilename(extractedTitle);
        if (sanitized) {
          console.log(`✅ Using extracted title: "${sanitized}"`);
          return sanitized;
        }
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
    if (!title || title.length < 3) {
      return null; // Return null for invalid titles so fallback can be used
    }
    
    // Remove invalid characters for filenames and clean up
    return title
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filesystem characters
      .replace(/[^\w\s\-\(\)\.]/g, '') // Keep only word chars, spaces, hyphens, parentheses, and dots
      .replace(/\s+/g, '-') // Replace spaces with hyphens (more readable than underscores)
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 150) // Allow longer titles but still reasonable
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

      // Find all summary channels - both with and without suffixes
      const summaryChannels = targetGuild.channels.cache.filter(
        channel => channel.name && (
          channel.name.startsWith(this.config.prefixes.summariesOutput) || // yt-summaries-1, yt-summaries-2, etc.
          channel.name === this.config.prefixes.summariesOutput.slice(0, -1) // yt-summaries (without dash)
        )
      );

      if (summaryChannels.size === 0) {
        this.logger.warn('No yt-summaries channels found');
        return;
      }

      // Process each summary channel only if it has a corresponding prompt channel with content
      for (const [channelId, channel] of summaryChannels) {
        try {
          // Extract the suffix from the summary channel or use empty string for base channel
          let channelSuffix = '';
          if (channel.name.startsWith(this.config.prefixes.summariesOutput)) {
            // Has prefix with suffix (e.g., yt-summaries-1 -> 1)
            channelSuffix = channel.name.replace(this.config.prefixes.summariesOutput, '');
          } else if (channel.name === this.config.prefixes.summariesOutput.slice(0, -1)) {
            // Base channel without suffix (e.g., yt-summaries -> '')
            channelSuffix = '';
          } else {
            this.logger.info(`Invalid channel name format: ${channel.name}, skipping`);
            continue;
          }
          
          // Find corresponding prompt channel
          let promptChannelName, promptChannel;
          
          if (channelSuffix) {
            // Channel with suffix (e.g., yt-summaries-1 -> yt-summary-prompt-1)
            promptChannelName = `${this.config.prefixes.summaryPrompt}${channelSuffix}`;
          } else {
            // Base channel without suffix (e.g., yt-summaries -> yt-summary-prompt)
            promptChannelName = this.config.prefixes.summaryPrompt.slice(0, -1);
          }
          
          promptChannel = targetGuild.channels.cache.find(
            ch => ch.name === promptChannelName
          );
          
          if (!promptChannel) {
            this.logger.info(`No prompt channel found for ${channel.name} (looking for ${promptChannelName}), skipping`);
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
      const summaryResult = await this.summary.generateSummary(transcript, videoTitle, originalMessage, customPrompt);
      
      if (!summaryResult || !summaryResult.summary) {
        this.logger.error(`Summary generation failed for video ${videoId}`);
        await channel.send(`❌ Failed to generate summary for video: ${videoTitle}`);
        return;
      }
      
      const summaryContent = summaryResult.summary;
      
      // Save summary for daily report
      const videoUrl = this.extractVideoUrl(originalMessage);
      await this.report.saveSummary({
        videoId,
        videoTitle,
        summaryContent,
        videoUrl
      });
      
      // Send summary to the channel without extra headers
      await this.sendLongMessage(channel, summaryContent);
      
      this.logger.info(`Summary sent to ${channel.name}`);
    } catch (error) {
      this.logger.error(`Error in summary channel ${channel.name}`, error);
    }
  }

  /**
   * Send a long message, breaking it into multiple messages or creating a file if too long
   * @param {import('discord.js').TextChannel} channel - Channel to send message
   * @param {string} content - Message content
   * @param {Object} options - Additional options
   */
  async sendLongMessage(channel, content, options = {}) {
    const MAX_DISCORD_MESSAGE_LENGTH = 2000;
    const { 
      fileFormat = 'txt', 
      fileName = `output_${Date.now()}`, 
      fallbackMessage = 'Content too long for Discord. See attached file.',
      forceFile = false  // Option to force file attachment even if content fits
    } = options;

    // Detect if content is JSON
    const isJsonContent = this.isJsonString(content);
    const effectiveFormat = isJsonContent ? 'json' : fileFormat;

    // If content is short enough and not forced to file, send directly
    if (content.length <= MAX_DISCORD_MESSAGE_LENGTH && !forceFile) {
      return await channel.send(content);
    }

    // For JSON content or large content, create a file attachment
    this.logger.info(`Sending long message as ${effectiveFormat} file (${content.length} chars)`);
    
    const fileContent = content;
    const fileBuffer = Buffer.from(fileContent, 'utf-8');
    const attachment = new AttachmentBuilder(fileBuffer, {
      name: `${fileName}.${effectiveFormat}`
    });

    // Send with file
    return await channel.send({
      content: fallbackMessage,
      files: [attachment]
    });
  }

  /**
   * Check if a string is valid JSON
   */
  isJsonString(str) {
    try {
      const trimmed = str.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return false;
      }
      JSON.parse(trimmed);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Convert content to JSON or text file based on request
   * @param {string} content - Content to convert
   * @param {string} format - Desired output format (json or txt)
   * @param {string} fileName - Base filename
   * @returns {Buffer} File buffer
   */
  convertToFileBuffer(content, format = 'txt', fileName = 'output') {
    let fileContent;
    switch (format.toLowerCase()) {
      case 'json':
        fileContent = JSON.stringify(
          typeof content === 'string' 
            ? { text: content } 
            : content, 
          null, 2
        );
        break;
      case 'txt':
      default:
        fileContent = content;
    }

    return {
      buffer: Buffer.from(fileContent, 'utf-8'),
      fileName: `${fileName}.${format}`
    };
  }

  /**
   * Handle long prompts by saving to file or breaking into multiple messages
   * @param {import('discord.js').TextChannel} channel - Channel to send prompt
   * @param {string} prompt - Prompt content
   * @param {Object} options - Additional options
   */
  async handleLongPrompt(channel, prompt, options = {}) {
    const MAX_DISCORD_MESSAGE_LENGTH = 2000;
    const { 
      fileFormat = 'txt', 
      fileName = `prompt_${Date.now()}`, 
      fallbackMessage = 'Prompt too long for Discord. See attached file.' 
    } = options;

    // If prompt is short enough, send directly
    if (prompt.length <= MAX_DISCORD_MESSAGE_LENGTH) {
      return await channel.send(prompt);
    }

    // Prepare file
    const { buffer, fileName: generatedFileName } = this.convertToFileBuffer(
      prompt, 
      fileFormat, 
      fileName
    );

    const attachment = new AttachmentBuilder(buffer, {
      name: generatedFileName
    });

    // Send with file
    return await channel.send({
      content: fallbackMessage,
      files: [attachment]
    });
  }

  async start() {
    if (!this.config.token) {
      throw new Error('Discord bot token not configured');
    }
    
    await this.client.login(this.config.token);
  }

  scheduleReports() {
    // Setup report scheduling once bot is ready
    this.client.once('ready', () => {
      this.setupAllReportSchedules();
    });
  }

  setupAllReportSchedules() {
    this.setupDailyReportSchedule();
    this.setupWeeklyReportSchedule();
    this.setupMonthlyReportSchedule();
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
        // Generate report and send directly to avoid circular calls
        const report = await this.report.generateDailyReport();
        await this.sendDailyReport(report);
        this.logger.info('Scheduled daily report completed successfully');
      } catch (error) {
        this.logger.error('Scheduled daily report failed', error);
      }
    });
  }

  setupWeeklyReportSchedule() {
    // Weekly reports on Sunday at 19:00 CEST
    const weeklyHour = 19;
    const weeklyMinute = 0;
    
    // Convert CEST to UTC for cron
    const now = new Date();
    const isDST = () => {
      const jan = new Date(now.getFullYear(), 0, 1);
      const jul = new Date(now.getFullYear(), 6, 1);
      return now.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    };
    
    const utcOffset = isDST() ? 2 : 1;
    const utcHour = (weeklyHour - utcOffset + 24) % 24;
    const cronExpression = `${weeklyMinute} ${utcHour} * * 0`; // Sunday = 0
    
    this.logger.info(`Setting up weekly report scheduler: ${cronExpression} (Sundays at ${weeklyHour}:${weeklyMinute.toString().padStart(2, '0')} CEST)`);
    
    // Schedule weekly report
    cron.schedule(cronExpression, async () => {
      this.logger.info('Running scheduled weekly report...');
      try {
        await this.sendWeeklyReport();
        this.logger.info('Scheduled weekly report completed successfully');
      } catch (error) {
        this.logger.error('Scheduled weekly report failed', error);
      }
    });
  }

  setupMonthlyReportSchedule() {
    // Monthly reports on 1st of each month at 20:00 CEST
    const monthlyHour = 20;
    const monthlyMinute = 0;
    
    // Convert CEST to UTC for cron
    const now = new Date();
    const isDST = () => {
      const jan = new Date(now.getFullYear(), 0, 1);
      const jul = new Date(now.getFullYear(), 6, 1);
      return now.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    };
    
    const utcOffset = isDST() ? 2 : 1;
    const utcHour = (monthlyHour - utcOffset + 24) % 24;
    const cronExpression = `${monthlyMinute} ${utcHour} 1 * *`; // 1st of month
    
    this.logger.info(`Setting up monthly report scheduler: ${cronExpression} (1st of each month at ${monthlyHour}:${monthlyMinute.toString().padStart(2, '0')} CEST)`);
    
    // Schedule monthly report
    cron.schedule(cronExpression, async () => {
      this.logger.info('Running scheduled monthly report...');
      try {
        await this.sendMonthlyReport();
        this.logger.info('Scheduled monthly report completed successfully');
      } catch (error) {
        this.logger.error('Scheduled monthly report failed', error);
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
      
      // Check for daily report prompt channels (handle both with and without suffix)
      const dailyReportPromptChannels = guild.channels.cache.filter(
        channel => channel.name && (
          channel.name.startsWith(this.config.prefixes.dailyReportPrompt) || // yt-daily-report-prompt-1, etc.
          channel.name === this.config.prefixes.dailyReportPrompt.slice(0, -1) // yt-daily-report-prompt (without dash)
        )
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
      
      // Find corresponding output channel - try both numbered and non-numbered
      const suffix = promptChannel.name.replace(this.config.prefixes.dailyReportPrompt, '');
      let outputChannel = null;
      
      if (suffix) {
        // Try numbered channel first (e.g., daily-report-1)
        const numberedChannelName = `daily-report-${suffix}`;
        outputChannel = guild.channels.cache.find(ch => ch.name === numberedChannelName);
      }
      
      if (!outputChannel) {
        // Fallback to default daily-report channel (without number)
        outputChannel = guild.channels.cache.find(
          channel => channel.name && channel.name === this.config.channels.dailyReport
        );
      }
      
      if (!outputChannel) {
        // Secondary fallback - any channel containing daily-report
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
      // CRITICAL FIX: If no summaries, return empty report immediately
      if (!summaries || summaries.length === 0) {
        console.log('🚨 No summaries found - returning empty report instead of asking OpenAI');
        const emptyReport = this.report.generateEmptyReport();
        return emptyReport.data; // Return just the text content
      }

      // Prepare summaries data for the prompt (using correct field names)
      const summariesData = summaries.map(summary => ({
        title: summary.videoTitle || summary.title,
        content: summary.summaryContent || summary.content,
        url: summary.videoUrl || summary.url,
        timestamp: summary.timestamp
      }));

      console.log(`📊 Generating custom report with ${summariesData.length} summaries`);

      const summariesText = summariesData.map((summary, index) => 
        `${index + 1}. ${summary.title}\nContent: ${summary.content}\nURL: ${summary.url}\nTime: ${new Date(summary.timestamp).toLocaleString()}\n`
      ).join('\n');

      // Use the dedicated custom report method instead of video summary method
      const customReport = await this.summary.generateCustomDailyReport(customPrompt, summariesText);
      return customReport; // Clean string return type
    } catch (error) {
      this.logger.error('Error generating custom daily report', error);
      console.error('🚨 Custom report generation failed, using fallback:', error);
      // Fallback to default report format
      const fallbackReport = this.report.buildReport(summaries);
      return fallbackReport.data; // Return just the text content
    }
  }

  // ============ WEEKLY REPORTS ============

  async sendWeeklyReport() {
    try {
      this.logger.info('Processing weekly reports...');
      
      // Find the configured guild
      const guild = this.client.guilds.cache.get(this.config.guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${this.config.guildId} not found`);
      }
      
      // Check for weekly report prompt channels (handle both with and without suffix)
      const weeklyReportPromptChannels = guild.channels.cache.filter(
        channel => channel.name && (
          channel.name.startsWith(this.config.prefixes.weeklyReportPrompt) || // yt-weekly-report-prompt-1, etc.
          channel.name === this.config.prefixes.weeklyReportPrompt.slice(0, -1) // yt-weekly-report-prompt (without dash)
        )
      );
      
      if (weeklyReportPromptChannels.size > 0) {
        // Process each weekly report prompt channel
        for (const [channelId, promptChannel] of weeklyReportPromptChannels) {
          await this.processWeeklyReportWithPrompt(guild, promptChannel);
        }
      } else {
        // Fallback to default weekly report
        await this.sendDefaultWeeklyReport(guild);
      }
      
      this.logger.info('Weekly report processing completed');
    } catch (error) {
      this.logger.error('Error processing weekly reports', error);
      throw error;
    }
  }

  async processWeeklyReportWithPrompt(guild, promptChannel) {
    try {
      // Get pinned messages from the prompt channel
      const pinnedMessages = await promptChannel.messages.fetchPinned();
      
      if (pinnedMessages.size === 0) {
        this.logger.info(`No pinned messages in ${promptChannel.name}, using default weekly report`);
        await this.sendDefaultWeeklyReport(guild);
        return;
      }

      // Use the first pinned message as the prompt
      const pinnedMessage = pinnedMessages.first();
      const customPrompt = pinnedMessage.content;
      this.logger.info(`Using custom weekly report prompt from ${promptChannel.name}`);

      // Generate weekly report
      const report = await this.report.generateWeeklyReport(customPrompt);
      
      // Find corresponding output channel - try both numbered and non-numbered  
      const suffix = promptChannel.name.replace(this.config.prefixes.weeklyReportPrompt, '');
      let outputChannel = null;
      
      if (suffix) {
        // Try numbered channel first (e.g., weekly-report-1)
        const numberedChannelName = `weekly-report-${suffix}`;
        outputChannel = guild.channels.cache.find(ch => ch.name === numberedChannelName);
      }
      
      if (!outputChannel) {
        // Try generic weekly-report channel (without number)
        outputChannel = guild.channels.cache.find(ch => ch.name === 'weekly-report');
      }
      
      if (!outputChannel) {
        // Last resort fallback
        outputChannel = guild.channels.cache.find(
          channel => channel.name && (
            channel.name.includes('general') || 
            channel.name.includes('bot') ||
            channel.name.includes('reports')
          )
        );
      }
      
      if (outputChannel) {
        this.logger.info(`Sending weekly report to channel: ${outputChannel.name}`);
        await this.sendLongMessage(outputChannel, report.data);
        this.logger.info(`Weekly report sent to ${outputChannel.name}`);
      } else {
        this.logger.error('No suitable output channel found for weekly report');
      }
    } catch (error) {
      this.logger.error(`Error processing weekly report prompt from ${promptChannel.name}`, error);
    }
  }

  async sendDefaultWeeklyReport(guild) {
    try {
      const report = await this.report.generateWeeklyReport();
      const outputChannel = guild.channels.cache.find(ch => ch.name === 'weekly-report') ||
                           guild.channels.cache.find(ch => ch.name && ch.name.includes('general'));
      
      if (outputChannel) {
        await this.sendLongMessage(outputChannel, report.data);
        this.logger.info(`Default weekly report sent to ${outputChannel.name}`);
      } else {
        this.logger.error('No suitable channel found for default weekly report');
      }
    } catch (error) {
      this.logger.error('Error sending default weekly report', error);
    }
  }

  // ============ MONTHLY REPORTS ============

  async sendMonthlyReport() {
    try {
      this.logger.info('Processing monthly reports...');
      
      // Find the configured guild
      const guild = this.client.guilds.cache.get(this.config.guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${this.config.guildId} not found`);
      }
      
      // Check for monthly report prompt channels (handle both with and without suffix)
      const monthlyReportPromptChannels = guild.channels.cache.filter(
        channel => channel.name && (
          channel.name.startsWith(this.config.prefixes.monthlyReportPrompt) || // yt-monthly-report-prompt-1, etc.
          channel.name === this.config.prefixes.monthlyReportPrompt.slice(0, -1) // yt-monthly-report-prompt (without dash)
        )
      );
      
      if (monthlyReportPromptChannels.size > 0) {
        // Process each monthly report prompt channel
        for (const [channelId, promptChannel] of monthlyReportPromptChannels) {
          await this.processMonthlyReportWithPrompt(guild, promptChannel);
        }
      } else {
        // Fallback to default monthly report
        await this.sendDefaultMonthlyReport(guild);
      }
      
      this.logger.info('Monthly report processing completed');
    } catch (error) {
      this.logger.error('Error processing monthly reports', error);
      throw error;
    }
  }

  async processMonthlyReportWithPrompt(guild, promptChannel) {
    try {
      // Get pinned messages from the prompt channel
      const pinnedMessages = await promptChannel.messages.fetchPinned();
      
      if (pinnedMessages.size === 0) {
        this.logger.info(`No pinned messages in ${promptChannel.name}, using default monthly report`);
        await this.sendDefaultMonthlyReport(guild);
        return;
      }

      // Use the first pinned message as the prompt
      const pinnedMessage = pinnedMessages.first();
      const customPrompt = pinnedMessage.content;
      this.logger.info(`Using custom monthly report prompt from ${promptChannel.name}`);

      // Generate monthly report
      const report = await this.report.generateMonthlyReport(customPrompt);
      
      // Find corresponding output channel - try both numbered and non-numbered
      const suffix = promptChannel.name.replace(this.config.prefixes.monthlyReportPrompt, '');
      let outputChannel = null;
      
      if (suffix) {
        // Try numbered channel first (e.g., monthly-report-1)
        const numberedChannelName = `monthly-report-${suffix}`;
        outputChannel = guild.channels.cache.find(ch => ch.name === numberedChannelName);
      }
      
      if (!outputChannel) {
        // Try generic monthly-report channel (without number)
        outputChannel = guild.channels.cache.find(ch => ch.name === 'monthly-report');
      }
      
      if (!outputChannel) {
        // Last resort fallback
        outputChannel = guild.channels.cache.find(
          channel => channel.name && (
            channel.name.includes('general') || 
            channel.name.includes('bot') ||
            channel.name.includes('reports')
          )
        );
      }
      
      if (outputChannel) {
        this.logger.info(`Sending monthly report to channel: ${outputChannel.name}`);
        await this.sendLongMessage(outputChannel, report.data);
        this.logger.info(`Monthly report sent to ${outputChannel.name}`);
      } else {
        this.logger.error('No suitable output channel found for monthly report');
      }
    } catch (error) {
      this.logger.error(`Error processing monthly report prompt from ${promptChannel.name}`, error);
    }
  }

  async sendDefaultMonthlyReport(guild) {
    try {
      const report = await this.report.generateMonthlyReport();
      const outputChannel = guild.channels.cache.find(ch => ch.name === 'monthly-report') ||
                           guild.channels.cache.find(ch => ch.name && ch.name.includes('general'));
      
      if (outputChannel) {
        await this.sendLongMessage(outputChannel, report.data);
        this.logger.info(`Default monthly report sent to ${outputChannel.name}`);
      } else {
        this.logger.error('No suitable channel found for default monthly report');
      }
    } catch (error) {
      this.logger.error('Error sending default monthly report', error);
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

  // Command helper methods
  async getChannelStatus() {
    try {
      const guild = this.client.guilds.cache.get(this.config.guildId);
      if (!guild) {
        throw new Error('Guild not found');
      }

      const channels = [];
      
      // Check monitoring channels
      const monitoringChannels = ['yt-uploads', 'yt-transcripts'];
      monitoringChannels.forEach(name => {
        const channel = guild.channels.cache.find(ch => ch.name === name);
        channels.push({
          name,
          type: 'monitoring',
          active: !!channel,
          lastActivity: channel ? 'Recently' : 'Channel not found'
        });
      });

      // Check summary output channels (dynamically detect all - with and without suffixes)  
      const summaryOutputChannels = guild.channels.cache.filter(
        ch => ch.name && (
          ch.name.startsWith(this.config.prefixes.summariesOutput) || // yt-summaries-1, yt-summaries-2, etc.
          ch.name === this.config.prefixes.summariesOutput.slice(0, -1) // yt-summaries (without dash)
        )
      );
      
      if (summaryOutputChannels.size === 0) {
        channels.push({
          name: 'yt-summaries-*',
          type: 'output',
          active: false,
          lastActivity: 'No summary output channels found'
        });
      } else {
        summaryOutputChannels.forEach(channel => {
          channels.push({
            name: channel.name,
            type: 'output',
            active: true,
            lastActivity: 'Recently'
          });
        });
      }

      // Check daily report channels (only show existing ones)
      const dailyReportChannels = guild.channels.cache.filter(
        ch => ch.name && (ch.name === 'daily-report' || ch.name.match(/^daily-report-\d+$/))
      );
      
      if (dailyReportChannels.size > 0) {
        dailyReportChannels.forEach(channel => {
          channels.push({
            name: channel.name,
            type: 'daily-reports',
            active: true,
            lastActivity: 'Daily at 18:00 CEST'
          });
        });
      } else {
        // Show at least one entry if no daily report channels exist
        channels.push({
          name: 'daily-report',
          type: 'daily-reports',
          active: false,
          lastActivity: 'No daily report channels found'
        });
      }
      
      // Check weekly report channels (only show existing ones)
      const weeklyReportChannels = guild.channels.cache.filter(
        ch => ch.name && (ch.name === 'weekly-report' || ch.name.match(/^weekly-report-\d+$/))
      );
      
      if (weeklyReportChannels.size > 0) {
        weeklyReportChannels.forEach(channel => {
          channels.push({
            name: channel.name,
            type: 'weekly-reports',
            active: true,
            lastActivity: 'Weekly on Sundays'
          });
        });
      } else {
        // Show at least one entry if no weekly report channels exist
        channels.push({
          name: 'weekly-report',
          type: 'weekly-reports',
          active: false,
          lastActivity: 'No weekly report channels found'
        });
      }
      
      // Check monthly report channels (only show existing ones)
      const monthlyReportChannels = guild.channels.cache.filter(
        ch => ch.name && (ch.name === 'monthly-report' || ch.name.match(/^monthly-report-\d+$/))
      );
      
      if (monthlyReportChannels.size > 0) {
        monthlyReportChannels.forEach(channel => {
          channels.push({
            name: channel.name,
            type: 'monthly-reports',
            active: true,
            lastActivity: 'Monthly on 1st'
          });
        });
      } else {
        // Show at least one entry if no monthly report channels exist
        channels.push({
          name: 'monthly-report',
          type: 'monthly-reports',
          active: false,
          lastActivity: 'No monthly report channels found'
        });
      }
      
      // Check summary prompt channels (dynamically detect all - with and without suffixes)
      const summaryPromptChannels = guild.channels.cache.filter(
        ch => ch.name && (
          ch.name.startsWith(this.config.prefixes.summaryPrompt) || // yt-summary-prompt-1, yt-summary-prompt-2, etc.
          ch.name === this.config.prefixes.summaryPrompt.slice(0, -1) // yt-summary-prompt (without dash)
        )
      );
      
      if (summaryPromptChannels.size === 0) {
        channels.push({
          name: 'yt-summary-prompt-*',
          type: 'prompts',
          active: false,
          lastActivity: 'No summary prompt channels found'
        });
      } else {
        summaryPromptChannels.forEach(channel => {
          channels.push({
            name: channel.name,
            type: 'prompts',
            active: true,
            lastActivity: 'Contains prompts'
          });
        });
      }
      
      return channels;
    } catch (error) {
      console.error('Error getting channel status:', error);
      throw error;
    }
  }

  async getCustomPromptFromChannel(channelName) {
    try {
      // Find the configured guild
      const guild = this.client.guilds.cache.get(this.config.guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${this.config.guildId} not found`);
      }
      
      // Find the prompt channel
      const promptChannel = guild.channels.cache.find(ch => ch.name === channelName);
      if (!promptChannel) {
        throw new Error(`Channel ${channelName} not found`);
      }
      
      // Get pinned messages from the prompt channel
      const pinnedMessages = await promptChannel.messages.fetchPinned();
      
      if (pinnedMessages.size === 0) {
        return null; // No pinned messages found
      }

      // Use the first pinned message as the prompt
      const pinnedMessage = pinnedMessages.first();
      return pinnedMessage.content;
      
    } catch (error) {
      this.logger.error(`Error getting custom prompt from ${channelName}`, error);
      throw error;
    }
  }

  async validateAllPrompts() {
    const results = [];
    const guild = this.client.guilds.cache.get(this.config.guildId);
    
    if (!guild) {
      results.push({
        channel: 'guild',
        valid: false,
        message: 'Guild not found'
      });
      return results;
    }
    
    // Check summary prompts (dynamically detect all - with and without suffixes)
    const summaryPromptChannels = guild.channels.cache.filter(
      ch => ch.name && (
        ch.name.startsWith(this.config.prefixes.summaryPrompt) || // yt-summary-prompt-1, yt-summary-prompt-2, etc.
        ch.name === this.config.prefixes.summaryPrompt.slice(0, -1) // yt-summary-prompt (without dash)
      )
    );
    
    if (summaryPromptChannels.size === 0) {
      results.push({
        channel: 'summary-prompts',
        valid: false,
        message: 'No summary prompt channels found'
      });
    } else {
      for (const [channelId, channel] of summaryPromptChannels) {
        try {
          const prompt = await this.getCustomPromptFromChannel(channel.name);
          results.push({
            channel: channel.name,
            valid: !!prompt,
            message: prompt ? `Loaded (${prompt.length} chars)` : 'No pinned prompt found'
          });
        } catch (error) {
          results.push({
            channel: channel.name,
            valid: false,
            message: error.message
          });
        }
      }
    }
    
    // Check daily report prompts (handle both with and without suffix)
    const dailyReportPromptChannels = guild.channels.cache.filter(
      ch => ch.name && (
        ch.name.startsWith(this.config.prefixes.dailyReportPrompt) || // yt-daily-report-prompt-1, etc.
        ch.name === this.config.prefixes.dailyReportPrompt.slice(0, -1) // yt-daily-report-prompt (without dash)
      )
    );
    
    if (dailyReportPromptChannels.size > 0) {
      for (const [channelId, channel] of dailyReportPromptChannels) {
        try {
          const prompt = await this.getCustomPromptFromChannel(channel.name);
          results.push({
            channel: channel.name,
            valid: !!prompt,
            message: prompt ? `Loaded (${prompt.length} chars)` : 'No pinned prompt found'
          });
        } catch (error) {
          results.push({
            channel: channel.name,
            valid: false,
            message: error.message
          });
        }
      }
    }
    
    // Check weekly report prompts (handle both with and without suffix)
    const weeklyReportPromptChannels = guild.channels.cache.filter(
      ch => ch.name && (
        ch.name.startsWith(this.config.prefixes.weeklyReportPrompt) || // yt-weekly-report-prompt-1, etc.
        ch.name === this.config.prefixes.weeklyReportPrompt.slice(0, -1) // yt-weekly-report-prompt (without dash)
      )
    );
    
    if (weeklyReportPromptChannels.size > 0) {
      for (const [channelId, channel] of weeklyReportPromptChannels) {
        try {
          const prompt = await this.getCustomPromptFromChannel(channel.name);
          results.push({
            channel: channel.name,
            valid: !!prompt,
            message: prompt ? `Loaded (${prompt.length} chars)` : 'No pinned prompt found'
          });
        } catch (error) {
          results.push({
            channel: channel.name,
            valid: false,
            message: error.message
          });
        }
      }
    }
    
    // Check monthly report prompts (handle both with and without suffix)
    const monthlyReportPromptChannels = guild.channels.cache.filter(
      ch => ch.name && (
        ch.name.startsWith(this.config.prefixes.monthlyReportPrompt) || // yt-monthly-report-prompt-1, etc.
        ch.name === this.config.prefixes.monthlyReportPrompt.slice(0, -1) // yt-monthly-report-prompt (without dash)
      )
    );
    
    if (monthlyReportPromptChannels.size > 0) {
      for (const [channelId, channel] of monthlyReportPromptChannels) {
        try {
          const prompt = await this.getCustomPromptFromChannel(channel.name);
          results.push({
            channel: channel.name,
            valid: !!prompt,
            message: prompt ? `Loaded (${prompt.length} chars)` : 'No pinned prompt found'
          });
        } catch (error) {
          results.push({
            channel: channel.name,
            valid: false,
            message: error.message
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Get channel monitoring status (compatibility method)
   */
  async getChannelStatus() {
    try {
      const guild = this.client.guilds.cache.get(this.config.guildId);
      if (!guild) {
        throw new Error('Guild not found');
      }

      const channels = [];
      
      // Check summary channels
      const summaryChannels = guild.channels.cache.filter(
        ch => ch.name && ch.name.includes('summaries')
      );
      
      for (const [id, channel] of summaryChannels) {
        channels.push({
          name: channel.name,
          type: 'summary',
          active: true,
          lastActivity: 'Active'
        });
      }

      // Check monitoring channels (allowed patterns)
      for (const pattern of this.config.allowedChannelPatterns) {
        const matchingChannels = guild.channels.cache.filter(
          ch => ch.name && ch.name.includes(pattern)
        );
        
        for (const [id, channel] of matchingChannels) {
          if (!channels.find(c => c.name === channel.name)) {
            channels.push({
              name: channel.name,
              type: 'monitoring',
              active: true,
              lastActivity: 'Monitored'
            });
          }
        }
      }

      return channels;
    } catch (error) {
      this.logger.error('Error getting channel status:', error);
      return [];
    }
  }
}

module.exports = DiscordService;
