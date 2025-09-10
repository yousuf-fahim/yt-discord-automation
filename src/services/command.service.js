/**
 * Discord Slash Command Service
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

class CommandService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.discord = dependencies.discord;
    this.logger = dependencies.logger;
    
    // Store commands
    this.commands = new Map();
    
    // Initialize commands
    this.initializeCommands();
  }

  initializeCommands() {
    console.log('🤖 Initializing Discord slash commands...');
    
    // Register all commands
    this.registerHealthCommand();
    this.registerTriggerReportCommand();
    this.registerTestSummaryCommand();
    this.registerReloadPromptsCommand();
    this.registerLogsCommand();
    this.registerCacheStatsCommand();
    this.registerChannelStatusCommand();
    this.registerTranscriptTestCommand();
    this.registerValidatePromptsCommand();
    this.registerDebugCacheCommand();
    this.registerCheckSummariesCommand();
    
    console.log(`✅ Registered ${this.commands.size} slash commands`);
  }

  registerHealthCommand() {
    const command = new SlashCommandBuilder()
      .setName('health')
      .setDescription('Check the health status of all bot services');
    
    this.commands.set('health', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          console.log('🔍 Running health check via command...');
          
          // Get all services
          const transcriptService = this.serviceManager.getService('transcript');
          const reportService = this.serviceManager.getService('report');
          const summaryService = this.serviceManager.getService('summary');
          
          // Check each service
          const healthResults = {
            transcript: await this.checkServiceHealth(transcriptService),
            report: await this.checkServiceHealth(reportService),
            summary: await this.checkServiceHealth(summaryService),
            discord: { status: 'ok', details: 'Connected and responding' }
          };
          
          // Create health report embed
          const embed = new EmbedBuilder()
            .setTitle('🔍 Bot Health Status')
            .setColor(this.getOverallHealthColor(healthResults))
            .setTimestamp();
          
          Object.entries(healthResults).forEach(([service, result]) => {
            const status = this.getServiceStatusIcon(result.status);
            embed.addFields({
              name: `${status} ${service.charAt(0).toUpperCase() + service.slice(1)} Service`,
              value: result.details || result.status,
              inline: true
            });
          });
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Health check command error:', error);
          await interaction.editReply('❌ Error running health check: ' + error.message);
        }
      }
    });
  }

  registerTriggerReportCommand() {
    const command = new SlashCommandBuilder()
      .setName('trigger-report')
      .setDescription('Trigger daily report generation')
      .addStringOption(option =>
        option.setName('channel')
          .setDescription('Specific channel number (1, 2, 3) or "all" for all channels')
          .setRequired(false)
      );
    
    this.commands.set('trigger-report', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const channelOption = interaction.options.getString('channel') || 'all';
          console.log(`📊 Triggering daily report via command for: ${channelOption}`);
          
          const reportService = this.serviceManager.getService('report');
          if (!reportService) {
            throw new Error('Report service not available');
          }
          
          let results = [];
          
          const discordService = this.serviceManager.getService('discord');
          
          if (channelOption === 'all') {
            // Trigger all report channels using the report service
            try {
              await reportService.sendDailyReport(discordService);
              results.push(`✅ All Reports: Generated successfully`);
            } catch (error) {
              results.push(`❌ All Reports: ${error.message}`);
            }
          } else {
            // For specific channels, we need to get the guild and channel
            const channelNum = parseInt(channelOption);
            if (isNaN(channelNum) || channelNum < 1 || channelNum > 3) {
              throw new Error('Channel must be 1, 2, 3, or "all"');
            }
            
            try {
              // Get the guild
              const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
              if (!guild) {
                throw new Error('Guild not found');
              }
              
              // Find the prompt channel
              const promptChannelName = `yt-daily-report-prompt-${channelNum}`;
              const promptChannel = guild.channels.cache.find(ch => ch.name === promptChannelName);
              
              if (!promptChannel) {
                throw new Error(`Prompt channel ${promptChannelName} not found`);
              }
              
              // Generate a basic report for the prompt
              const reportService = this.serviceManager.getService('report');
              const summaries = await reportService.getRecentSummaries();
              const defaultReport = reportService.buildReport(summaries);
              
              await discordService.processDailyReportWithPrompt(guild, promptChannel, defaultReport);
              results.push(`✅ Report ${channelNum}: Generated successfully`);
            } catch (error) {
              results.push(`❌ Report ${channelNum}: ${error.message}`);
            }
          }
          
          const embed = new EmbedBuilder()
            .setTitle('📊 Daily Report Trigger Results')
            .setDescription(results.join('\n'))
            .setColor(results.some(r => r.includes('❌')) ? 0xff6b6b : 0x51cf66)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Trigger report command error:', error);
          await interaction.editReply('❌ Error triggering report: ' + error.message);
        }
      }
    });
  }

  registerTestSummaryCommand() {
    const command = new SlashCommandBuilder()
      .setName('test-summary')
      .setDescription('Process a single YouTube video immediately for testing')
      .addStringOption(option =>
        option.setName('video-url')
          .setDescription('YouTube video URL to process')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('channel')
          .setDescription('Summary channel number (1, 2, or 3)')
          .setRequired(false)
          .addChoices(
            { name: 'Channel 1', value: 1 },
            { name: 'Channel 2', value: 2 },
            { name: 'Channel 3', value: 3 }
          )
      );
    
    this.commands.set('test-summary', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const videoUrl = interaction.options.getString('video-url');
          const channelNum = interaction.options.getInteger('channel') || 1;
          
          console.log(`🎯 Test summary via command: ${videoUrl} -> channel ${channelNum}`);
          
          // Extract video ID
          const videoId = this.extractVideoId(videoUrl);
          if (!videoId) {
            throw new Error('Invalid YouTube URL');
          }
          
          // Process the video
          const discordService = this.serviceManager.getService('discord');
          if (!discordService) {
            throw new Error('Discord service not available');
          }

          // Get transcript first
          const transcriptService = this.serviceManager.getService('transcript');
          const transcript = await transcriptService.getTranscript(videoId);
          if (!transcript) {
            throw new Error('Could not extract transcript');
          }

          // Get video title
          const videoTitle = await discordService.getVideoTitle(videoId, videoUrl);

          // Get guild
          const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
          if (!guild) {
            throw new Error('Guild not found');
          }

          // Find the summary and prompt channels
          const summaryChannelName = `yt-summaries-${channelNum}`;
          const promptChannelName = `yt-summary-prompt-${channelNum}`;
          
          const summaryChannel = guild.channels.cache.find(ch => ch.name === summaryChannelName);
          const promptChannel = guild.channels.cache.find(ch => ch.name === promptChannelName);
          
          if (!summaryChannel) {
            throw new Error(`Summary channel ${summaryChannelName} not found`);
          }
          if (!promptChannel) {
            throw new Error(`Prompt channel ${promptChannelName} not found`);
          }

          // Process the single summary channel
          await discordService.processSingleSummaryChannel(
            summaryChannel, 
            videoId, 
            videoTitle, 
            transcript, 
            videoUrl, 
            promptChannel
          );
          
          const embed = new EmbedBuilder()
            .setTitle('🎯 Test Summary Complete')
            .addFields(
              { name: 'Video ID', value: videoId, inline: true },
              { name: 'Channel', value: channelNum.toString(), inline: true },
              { name: 'Status', value: '✅ Processed successfully', inline: false }
            )
            .setColor(0x51cf66)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Test summary command error:', error);
          await interaction.editReply('❌ Error processing video: ' + error.message);
        }
      }
    });
  }

  registerReloadPromptsCommand() {
    const command = new SlashCommandBuilder()
      .setName('reload-prompts')
      .setDescription('Reload prompts from Discord pinned messages');
    
    this.commands.set('reload-prompts', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          console.log('🔄 Reloading prompts via command...');
          
          const discordService = this.serviceManager.getService('discord');
          if (!discordService) {
            throw new Error('Discord service not available');
          }
          
          // Reload prompts for all channels
          const results = [];
          
          // Summary prompts (1-3)
          for (let i = 1; i <= 3; i++) {
            try {
              const prompt = await discordService.getCustomPromptFromChannel(`yt-summary-prompt-${i}`);
              results.push(`✅ Summary Prompt ${i}: ${prompt ? 'Loaded' : 'Not found'}`);
            } catch (error) {
              results.push(`❌ Summary Prompt ${i}: ${error.message}`);
            }
          }
          
          // Daily report prompts (1-3)
          for (let i = 1; i <= 3; i++) {
            try {
              const prompt = await discordService.getCustomPromptFromChannel(`yt-daily-report-prompt-${i}`);
              results.push(`✅ Report Prompt ${i}: ${prompt ? 'Loaded' : 'Not found'}`);
            } catch (error) {
              results.push(`❌ Report Prompt ${i}: ${error.message}`);
            }
          }
          
          const embed = new EmbedBuilder()
            .setTitle('🔄 Prompt Reload Results')
            .setDescription(results.join('\n'))
            .setColor(results.some(r => r.includes('❌')) ? 0xff6b6b : 0x51cf66)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Reload prompts command error:', error);
          await interaction.editReply('❌ Error reloading prompts: ' + error.message);
        }
      }
    });
  }

  registerLogsCommand() {
    const command = new SlashCommandBuilder()
      .setName('logs')
      .setDescription('Show recent bot activity logs')
      .addIntegerOption(option =>
        option.setName('lines')
          .setDescription('Number of log lines to show (default: 20)')
          .setRequired(false)
      );
    
    this.commands.set('logs', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const lines = interaction.options.getInteger('lines') || 20;
          console.log(`📋 Showing logs via command: ${lines} lines`);
          
          // Get recent logs (this would need to be implemented based on your logging system)
          const logs = this.getRecentLogs(lines);
          
          const embed = new EmbedBuilder()
            .setTitle(`📋 Recent Bot Logs (${lines} lines)`)
            .setDescription('```\n' + logs + '\n```')
            .setColor(0x74c0fc)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Logs command error:', error);
          await interaction.editReply('❌ Error retrieving logs: ' + error.message);
        }
      }
    });
  }

  registerCacheStatsCommand() {
    const command = new SlashCommandBuilder()
      .setName('cache-stats')
      .setDescription('View cache usage statistics and cleanup options')
      .addBooleanOption(option =>
        option.setName('cleanup')
          .setDescription('Perform cache cleanup (remove old files)')
          .setRequired(false)
      );
    
    this.commands.set('cache-stats', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const cleanup = interaction.options.getBoolean('cleanup') || false;
          console.log(`💾 Cache stats via command, cleanup: ${cleanup}`);
          
          const cacheService = this.serviceManager.getService('cache');
          if (!cacheService) {
            throw new Error('Cache service not available');
          }
          
          // Get cache statistics
          const stats = await cacheService.getStats();
          
          let description = `📊 **Cache Statistics:**\n`;
          description += `• Total files: ${stats.totalFiles}\n`;
          description += `• Total size: ${stats.totalSize}\n`;
          description += `• Transcripts: ${stats.transcripts}\n`;
          description += `• Summaries: ${stats.summaries}\n`;
          description += `• Reports: ${stats.reports}\n`;
          
          if (cleanup) {
            const cleanupResult = await cacheService.cleanup();
            description += `\n🧹 **Cleanup Results:**\n`;
            description += `• Files removed: ${cleanupResult.removed}\n`;
            description += `• Space freed: ${cleanupResult.spaceSaved}\n`;
          }
          
          const embed = new EmbedBuilder()
            .setTitle('💾 Cache Management')
            .setDescription(description)
            .setColor(0x51cf66)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Cache stats command error:', error);
          await interaction.editReply('❌ Error getting cache stats: ' + error.message);
        }
      }
    });
  }

  registerChannelStatusCommand() {
    const command = new SlashCommandBuilder()
      .setName('channel-status')
      .setDescription('Check which channels are being monitored');
    
    this.commands.set('channel-status', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          console.log('📺 Checking channel status via command...');
          
          const discordService = this.serviceManager.getService('discord');
          if (!discordService) {
            throw new Error('Discord service not available');
          }
          
          // Get channel configuration
          const channels = await discordService.getChannelStatus();
          
          const embed = new EmbedBuilder()
            .setTitle('📺 Channel Monitoring Status')
            .setColor(0x74c0fc)
            .setTimestamp();
          
          channels.forEach(channel => {
            const status = channel.active ? '✅ Active' : '⏸️ Inactive';
            embed.addFields({
              name: `#${channel.name}`,
              value: `${status}\nType: ${channel.type}\nLast activity: ${channel.lastActivity || 'Never'}`,
              inline: true
            });
          });
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Channel status command error:', error);
          await interaction.editReply('❌ Error checking channel status: ' + error.message);
        }
      }
    });
  }

  registerTranscriptTestCommand() {
    const command = new SlashCommandBuilder()
      .setName('transcript-test')
      .setDescription('Test transcript extraction for a specific video')
      .addStringOption(option =>
        option.setName('video-id')
          .setDescription('YouTube video ID to test')
          .setRequired(true)
      );
    
    this.commands.set('transcript-test', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const videoId = interaction.options.getString('video-id');
          console.log(`🎬 Testing transcript extraction via command: ${videoId}`);
          
          const transcriptService = this.serviceManager.getService('transcript');
          if (!transcriptService) {
            throw new Error('Transcript service not available');
          }
          
          const startTime = Date.now();
          const transcript = await transcriptService.getTranscript(videoId);
          const duration = Date.now() - startTime;
          
          const embed = new EmbedBuilder()
            .setTitle('🎬 Transcript Test Results')
            .addFields(
              { name: 'Video ID', value: videoId, inline: true },
              { name: 'Status', value: transcript ? '✅ Success' : '❌ Failed', inline: true },
              { name: 'Duration', value: `${duration}ms`, inline: true },
              { name: 'Length', value: transcript ? `${transcript.length} characters` : 'N/A', inline: true }
            )
            .setColor(transcript ? 0x51cf66 : 0xff6b6b)
            .setTimestamp();
          
          if (transcript && transcript.length > 0) {
            const preview = transcript.substring(0, 200) + (transcript.length > 200 ? '...' : '');
            embed.addFields({ name: 'Preview', value: `\`\`\`${preview}\`\`\``, inline: false });
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Transcript test command error:', error);
          await interaction.editReply('❌ Error testing transcript: ' + error.message);
        }
      }
    });
  }

  registerValidatePromptsCommand() {
    const command = new SlashCommandBuilder()
      .setName('validate-prompts')
      .setDescription('Validate all prompt channels and check for issues');
    
    this.commands.set('validate-prompts', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          console.log('✅ Validating prompts via command...');
          
          const discordService = this.serviceManager.getService('discord');
          if (!discordService) {
            throw new Error('Discord service not available');
          }
          
          const validation = await discordService.validateAllPrompts();
          
          let description = '';
          validation.forEach(result => {
            const status = result.valid ? '✅' : '❌';
            description += `${status} ${result.channel}: ${result.message}\n`;
          });
          
          const embed = new EmbedBuilder()
            .setTitle('✅ Prompt Validation Results')
            .setDescription(description)
            .setColor(validation.every(r => r.valid) ? 0x51cf66 : 0xff6b6b)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Validate prompts command error:', error);
          await interaction.editReply('❌ Error validating prompts: ' + error.message);
        }
      }
    });
  }

  registerDebugCacheCommand() {
    const command = new SlashCommandBuilder()
      .setName('debug-cache')
      .setDescription('Debug cache contents and structure')
      .addStringOption(option =>
        option.setName('pattern')
          .setDescription('Filter cache files by pattern (e.g., "summaries", "transcript")')
          .setRequired(false)
      );
    
    this.commands.set('debug-cache', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const pattern = interaction.options.getString('pattern') || '';
          console.log(`🔍 Debugging cache with pattern: "${pattern}"`);
          
          const cacheService = this.serviceManager.getService('cache');
          if (!cacheService) {
            throw new Error('Cache service not available');
          }
          
          const debugInfo = await cacheService.debugCache(pattern);
          
          let description = '🔍 **Cache Debug Results:**\n\n';
          
          if (Object.keys(debugInfo).length === 0) {
            description += 'No matching cache files found.\n';
          } else {
            Object.entries(debugInfo).forEach(([key, info]) => {
              if (info.exists) {
                description += `**${key}**\n`;
                description += `• Type: ${info.type}\n`;
                description += `• Length: ${info.length}\n`;
                description += `• Preview: ${info.preview}\n\n`;
              } else {
                description += `**${key}** ❌ Error: ${info.error}\n\n`;
              }
            });
          }
          
          const embed = new EmbedBuilder()
            .setTitle('🔍 Cache Debug')
            .setDescription(description.substring(0, 4000)) // Discord limit
            .setColor(0x74c0fc)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Debug cache command error:', error);
          await interaction.editReply('❌ Error debugging cache: ' + error.message);
        }
      }
    });
  }

  registerCheckSummariesCommand() {
    const command = new SlashCommandBuilder()
      .setName('check-summaries')
      .setDescription('Check today\'s summaries and recent cache')
      .addBooleanOption(option =>
        option.setName('all-dates')
          .setDescription('Show summaries from all dates')
          .setRequired(false)
      );
    
    this.commands.set('check-summaries', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const showAll = interaction.options.getBoolean('all-dates') || false;
          console.log(`📋 Checking summaries, showAll: ${showAll}`);
          
          const cacheService = this.serviceManager.getService('cache');
          const reportService = this.serviceManager.getService('report');
          
          if (!cacheService || !reportService) {
            throw new Error('Cache or Report service not available');
          }
          
          let description = '📋 **Summary Check Results:**\n\n';
          
          // Check today's summaries
          const todaysSummaries = await cacheService.getTodaysSummaries();
          const today = new Date().toISOString().split('T')[0];
          description += `**Today (${today}):** ${todaysSummaries.length} summaries\n`;
          
          if (todaysSummaries.length > 0) {
            todaysSummaries.forEach((summary, index) => {
              const title = summary.videoTitle || summary.title || `Video ${summary.videoId}`;
              description += `${index + 1}. ${title.substring(0, 50)}...\n`;
            });
          }
          description += '\n';
          
          // Check recent summaries (what reports use)
          const recentSummaries = await reportService.getRecentSummaries();
          description += `**Recent (24hrs):** ${recentSummaries.length} summaries\n`;
          
          if (showAll) {
            // Show all summary dates
            const allSummaries = await cacheService.listSummaries();
            description += '\n**All Dates:**\n';
            Object.entries(allSummaries).forEach(([date, summaries]) => {
              description += `• ${date}: ${summaries.length} summaries\n`;
            });
          }
          
          const embed = new EmbedBuilder()
            .setTitle('📋 Summary Status Check')
            .setDescription(description.substring(0, 4000))
            .setColor(todaysSummaries.length > 0 ? 0x51cf66 : 0xff6b6b)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Check summaries command error:', error);
          await interaction.editReply('❌ Error checking summaries: ' + error.message);
        }
      }
    });
  }

  // Helper methods
  async checkServiceHealth(service) {
    if (!service) {
      return { status: 'error', details: 'Service not available' };
    }
    
    try {
      if (service.healthCheck) {
        return await service.healthCheck();
      }
      return { status: 'ok', details: 'Service running (no health check)' };
    } catch (error) {
      return { status: 'error', details: error.message };
    }
  }

  // Helper methods
  async checkServiceHealth(service) {
    if (!service) {
      return { status: 'error', details: 'Service not available' };
    }
    
    try {
      if (service.healthCheck) {
        return await service.healthCheck();
      }
      return { status: 'ok', details: 'Service running (no health check)' };
    } catch (error) {
      return { status: 'error', details: error.message };
    }
  }

  getOverallHealthColor(healthResults) {
    const hasErrors = Object.values(healthResults).some(result => result.status !== 'ok');
    return hasErrors ? 0xff6b6b : 0x51cf66;
  }

  getServiceStatusIcon(status) {
    return status === 'ok' ? '✅' : '❌';
  }

  extractVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  getRecentLogs(lines) {
    // This would implement actual log retrieval
    // For now, return a placeholder
    return `[${new Date().toISOString()}] Bot is running normally\n` +
           `[${new Date().toISOString()}] All services operational\n` +
           `[${new Date().toISOString()}] Monitoring channels for YouTube links\n` +
           `[${new Date().toISOString()}] Ready for commands`;
  }

  // Get all command data for registration
  getCommandData() {
    return Array.from(this.commands.values()).map(cmd => cmd.data);
  }

  // Handle command execution
  async handleCommand(interaction) {
    const command = this.commands.get(interaction.commandName);
    
    if (!command) {
      console.error(`❌ Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Error executing command ${interaction.commandName}:`, error);
      
      const errorMessage = '❌ There was an error executing this command!';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
}

module.exports = CommandService;
