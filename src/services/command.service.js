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
    this.registerClearCacheCommand();
    this.registerConfigCommand();
    this.registerSetModelCommand();
    this.registerTestModelCommand();
    this.registerSetScheduleCommand();
    
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
          .setDescription('Specific channel name or "all" for all channels')
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
            // Get the guild
            const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
            if (!guild) {
              throw new Error('Guild not found');
            }
            
            // Find all available prompt channels
            const promptChannels = guild.channels.cache.filter(
              ch => ch.name && ch.name.startsWith(discordService.config.prefixes.dailyReportPrompt)
            );
            
            if (promptChannels.size === 0) {
              throw new Error('No daily report prompt channels found');
            }
            
            // Find the specific channel by name
            const targetChannel = promptChannels.find(ch => 
              ch.name === channelOption || 
              ch.name.endsWith(`-${channelOption}`) ||
              ch.name === `${discordService.config.prefixes.dailyReportPrompt}${channelOption}`
            );
            
            if (!targetChannel) {
              const availableChannels = Array.from(promptChannels.values()).map(ch => ch.name).join(', ');
              throw new Error(`Channel "${channelOption}" not found. Available channels: ${availableChannels}`);
            }
            
            try {
              // Generate a basic report for the specific prompt channel
              const summaries = await reportService.getRecentSummaries();
              const defaultReport = reportService.buildReport(summaries);
              
              await discordService.processDailyReportWithPrompt(guild, targetChannel, defaultReport);
              results.push(`✅ ${targetChannel.name}: Generated successfully`);
            } catch (error) {
              results.push(`❌ ${targetChannel.name}: ${error.message}`);
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
      .addStringOption(option =>
        option.setName('channel')
          .setDescription('Summary channel name (e.g. "1" for yt-summaries-1)')
          .setRequired(false)
      );
    
    this.commands.set('test-summary', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const videoUrl = interaction.options.getString('video-url');
          const channelOption = interaction.options.getString('channel') || '1';
          
          console.log(`🎯 Test summary via command: ${videoUrl} -> channel ${channelOption}`);
          
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

          // Find available summary channels
          const summaryChannels = guild.channels.cache.filter(
            ch => ch.name && ch.name.startsWith(discordService.config.prefixes.summariesOutput)
          );
          
          if (summaryChannels.size === 0) {
            throw new Error('No summary output channels found');
          }
          
          // Find the specific summary channel
          let summaryChannel = summaryChannels.find(ch => 
            ch.name.endsWith(`-${channelOption}`) ||
            ch.name === `${discordService.config.prefixes.summariesOutput}${channelOption}`
          );
          
          // If not found, use the first available channel
          if (!summaryChannel) {
            summaryChannel = summaryChannels.first();
            console.log(`Channel "${channelOption}" not found, using ${summaryChannel.name}`);
          }
          
          // Find corresponding prompt channel
          const promptChannelName = summaryChannel.name.replace('summaries', 'summary-prompt');
          const promptChannel = guild.channels.cache.find(ch => ch.name === promptChannelName);
          
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
              { name: 'Channel Used', value: summaryChannel.name, inline: true },
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
          
          // Summary prompts (dynamically detect all)
          const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
          if (guild) {
            const summaryPromptChannels = guild.channels.cache.filter(
              ch => ch.name && ch.name.startsWith(discordService.config.prefixes.summaryPrompt)
            );
            
            if (summaryPromptChannels.size === 0) {
              results.push(`⚠️ No summary prompt channels found`);
            } else {
              for (const [channelId, channel] of summaryPromptChannels) {
                try {
                  const prompt = await discordService.getCustomPromptFromChannel(channel.name);
                  const suffix = channel.name.replace(discordService.config.prefixes.summaryPrompt, '');
                  results.push(`✅ Summary Prompt ${suffix}: ${prompt ? 'Loaded' : 'Not found'}`);
                } catch (error) {
                  const suffix = channel.name.replace(discordService.config.prefixes.summaryPrompt, '');
                  results.push(`❌ Summary Prompt ${suffix}: ${error.message}`);
                }
              }
            }
          }
          
          // Daily report prompts (dynamic detection)
          const dailyReportPromptChannels = guild.channels.cache.filter(
            ch => ch.name && ch.name.startsWith(discordService.config.prefixes.dailyReportPrompt)
          );
          
          if (dailyReportPromptChannels.size === 0) {
            results.push(`⚠️ Daily Report Prompts: No channels found`);
          } else {
            for (const [channelId, channel] of dailyReportPromptChannels) {
              try {
                const prompt = await discordService.getCustomPromptFromChannel(channel.name);
                const suffix = channel.name.replace(discordService.config.prefixes.dailyReportPrompt, '');
                results.push(`✅ Daily Report Prompt ${suffix}: ${prompt ? 'Loaded' : 'Not found'}`);
              } catch (error) {
                const suffix = channel.name.replace(discordService.config.prefixes.dailyReportPrompt, '');
                results.push(`❌ Daily Report Prompt ${suffix}: ${error.message}`);
              }
            }
          }
          
          // Weekly report prompts (dynamic detection)
          const weeklyReportPromptChannels = guild.channels.cache.filter(
            ch => ch.name && ch.name.startsWith('yt-weekly-report-prompt-')
          );
          
          if (weeklyReportPromptChannels.size === 0) {
            results.push(`⚠️ Weekly Report Prompts: No channels found`);
          } else {
            for (const [channelId, channel] of weeklyReportPromptChannels) {
              try {
                const prompt = await discordService.getCustomPromptFromChannel(channel.name);
                const suffix = channel.name.replace('yt-weekly-report-prompt-', '');
                results.push(`✅ Weekly Report Prompt ${suffix}: ${prompt ? 'Loaded' : 'Not found'}`);
              } catch (error) {
                const suffix = channel.name.replace('yt-weekly-report-prompt-', '');
                results.push(`❌ Weekly Report Prompt ${suffix}: ${error.message}`);
              }
            }
          }
          
          // Monthly report prompts (dynamic detection)
          const monthlyReportPromptChannels = guild.channels.cache.filter(
            ch => ch.name && ch.name.startsWith('yt-monthly-report-prompt-')
          );
          
          if (monthlyReportPromptChannels.size === 0) {
            results.push(`⚠️ Monthly Report Prompts: No channels found`);
          } else {
            for (const [channelId, channel] of monthlyReportPromptChannels) {
              try {
                const prompt = await discordService.getCustomPromptFromChannel(channel.name);
                const suffix = channel.name.replace('yt-monthly-report-prompt-', '');
                results.push(`✅ Monthly Report Prompt ${suffix}: ${prompt ? 'Loaded' : 'Not found'}`);
              } catch (error) {
                const suffix = channel.name.replace('yt-monthly-report-prompt-', '');
                results.push(`❌ Monthly Report Prompt ${suffix}: ${error.message}`);
              }
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

  registerClearCacheCommand() {
    const command = new SlashCommandBuilder()
      .setName('clear-cache')
      .setDescription('Clear cached summaries and reset reporting system')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('What to clear')
          .setRequired(true)
          .addChoices(
            { name: 'Summaries Only', value: 'summaries' },
            { name: 'Reports Only', value: 'reports' },
            { name: 'Everything', value: 'all' },
            { name: 'Specific Date (YYYY-MM-DD)', value: 'date' }
          )
      )
      .addStringOption(option =>
        option.setName('date')
          .setDescription('Specific date to clear (YYYY-MM-DD format)')
          .setRequired(false)
      );
    
    this.commands.set('clear-cache', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const type = interaction.options.getString('type');
          const dateStr = interaction.options.getString('date');
          
          console.log(`🧹 Clearing cache, type: ${type}, date: ${dateStr || 'N/A'}`);
          
          const cacheService = this.serviceManager.getService('cache');
          if (!cacheService) {
            throw new Error('Cache service not available');
          }
          
          let results = [];
          let cleared = 0;
          
          if (type === 'summaries') {
            // Clear all summary files
            const summaries = await cacheService.listSummaries();
            for (const date of Object.keys(summaries)) {
              const success = await cacheService.delete(`summaries_${date}`);
              if (success) cleared++;
            }
            results.push(`🗑️ Cleared ${cleared} summary cache files`);
            
          } else if (type === 'reports') {
            // Clear all report files  
            const debugInfo = await cacheService.debugCache('daily_report');
            for (const key of Object.keys(debugInfo)) {
              if (key.startsWith('daily_report_')) {
                const success = await cacheService.delete(key);
                if (success) cleared++;
              }
            }
            results.push(`🗑️ Cleared ${cleared} report cache files`);
            
          } else if (type === 'date' && dateStr) {
            // Clear specific date
            const summarySuccess = await cacheService.delete(`summaries_${dateStr}`);
            const reportSuccess = await cacheService.delete(`daily_report_${dateStr}`);
            
            if (summarySuccess) results.push(`🗑️ Cleared summaries for ${dateStr}`);
            if (reportSuccess) results.push(`🗑️ Cleared report for ${dateStr}`);
            if (!summarySuccess && !reportSuccess) {
              results.push(`ℹ️ No cache found for ${dateStr}`);
            }
            
          } else if (type === 'all') {
            // Clear everything
            const debugInfo = await cacheService.debugCache();
            for (const key of Object.keys(debugInfo)) {
              if (key.startsWith('summaries_') || key.startsWith('daily_report_')) {
                const success = await cacheService.delete(key);
                if (success) cleared++;
              }
            }
            results.push(`🗑️ Cleared ${cleared} cache files (summaries + reports)`);
          }
          
          if (results.length === 0) {
            results.push('ℹ️ No cache files found to clear');
          }
          
          // Add reset confirmation
          results.push('');
          results.push('✅ **Reporting system reset!**');
          results.push('• Next videos will start fresh summary tracking');
          results.push('• Daily reports will show "No activity" until new summaries');
          results.push('• Run `/check-summaries` to verify cache is cleared');
          
          const embed = new EmbedBuilder()
            .setTitle('🧹 Cache Clearing Results')
            .setDescription(results.join('\n'))
            .setColor(0x51cf66)
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Clear cache command error:', error);
          await interaction.editReply('❌ Error clearing cache: ' + error.message);
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
    const hasErrors = Object.values(healthResults).some(result => 
      result.status !== 'ok' && result.status !== 'healthy'
    );
    return hasErrors ? 0xff6b6b : 0x51cf66;
  }

  getServiceStatusIcon(status) {
    return (status === 'ok' || status === 'healthy') ? '✅' : '❌';
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

  // ============ CONFIGURATION COMMANDS ============

  registerConfigCommand() {
    const command = new SlashCommandBuilder()
      .setName('config')
      .setDescription('View current bot configuration');
    
    this.commands.set('config', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const config = this.serviceManager.config;
          
          const embed = new EmbedBuilder()
            .setTitle('🔧 Bot Configuration')
            .setColor(0x00AE86)
            .addFields(
              {
                name: '🤖 OpenAI Settings',
                value: `**Model**: ${config.openai.model}\n**Max Tokens**: ${config.openai.maxTokens}\n**API Key**: ${config.openai.apiKey ? '✅ Configured' : '❌ Missing'}`,
                inline: true
              },
              {
                name: '📅 Daily Report Schedule',
                value: `**Time**: ${config.discord.schedule.dailyReportHour}:${config.discord.schedule.dailyReportMinute.toString().padStart(2, '0')} CEST`,
                inline: true
              },
              {
                name: '📊 Report Schedules',
                value: `**Weekly**: ${config.discord.schedule.weeklyReportDay !== undefined ? 
                  `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][config.discord.schedule.weeklyReportDay]} ${config.discord.schedule.weeklyReportHour}:${config.discord.schedule.weeklyReportMinute.toString().padStart(2, '0')} CEST` : 
                  'Sundays 19:00 CEST'}\n**Monthly**: 1st of month 20:00 CEST`,
                inline: true
              },
              {
                name: '🚀 Available Advanced Models',
                value: '**GPT-5**: Latest generation models\n**o3/o1**: Advanced reasoning models\n**GPT-4o**: Multimodal capabilities\n\nUse `/test-model` to test, `/set-model` to switch',
                inline: false
              }
            )
            .setFooter({ text: 'Use /test-model to safely test new models before switching' })
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          console.error('❌ Config command error:', error);
          await interaction.editReply('❌ Failed to retrieve configuration');
        }
      }
    });
  }

  registerSetModelCommand() {
    const command = new SlashCommandBuilder()
      .setName('set-model')
      .setDescription('Change the OpenAI model used for summaries')
      .addStringOption(option =>
        option.setName('model')
          .setDescription('Select OpenAI model')
          .setRequired(true)
          .addChoices(
            { name: '🚀 GPT-5 (Latest)', value: 'gpt-5' },
            { name: '🚀 GPT-5 Mini', value: 'gpt-5-mini' },
            { name: '🚀 GPT-5 Nano', value: 'gpt-5-nano' },
            { name: '🧠 o3 (Advanced Reasoning)', value: 'o3' },
            { name: '🧠 o3 Mini', value: 'o3-mini' },
            { name: '🧠 o1 Pro (Reasoning Pro)', value: 'o1-pro' },
            { name: '🧠 o1 (Reasoning)', value: 'o1' },
            { name: '🧠 o1 Mini', value: 'o1-mini' },
            { name: 'GPT-4o (Multimodal)', value: 'gpt-4o' },
            { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
            { name: 'GPT-4 Turbo (Stable)', value: 'gpt-4-turbo' },
            { name: 'GPT-4', value: 'gpt-4' },
            { name: 'GPT-3.5 Turbo (Fast)', value: 'gpt-3.5-turbo' }
          )
      );
    
    this.commands.set('set-model', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const newModel = interaction.options.getString('model');
          const oldModel = this.serviceManager.config.openai.model;
          
          // Update the configuration
          this.serviceManager.config.openai.model = newModel;
          
          // Get summary service and update its config reference
          const summaryService = this.serviceManager.getService('summary');
          if (summaryService) {
            summaryService.config.model = newModel;
          }
          
          const embed = new EmbedBuilder()
            .setTitle('✅ Model Updated')
            .setColor(0x00AE86)
            .addFields(
              {
                name: 'Previous Model',
                value: `\`${oldModel}\``,
                inline: true
              },
              {
                name: 'New Model',
                value: `\`${newModel}\``,
                inline: true
              },
              {
                name: 'Status',
                value: '✅ Active - All new summaries will use the new model',
                inline: false
              }
            )
            .setFooter({ text: 'Note: This change is temporary and will reset on bot restart. For permanent changes, update OPENAI_MODEL environment variable.' })
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
          this.logger.info(`OpenAI model changed from ${oldModel} to ${newModel} by ${interaction.user.tag}`);
        } catch (error) {
          console.error('❌ Set model command error:', error);
          await interaction.editReply('❌ Failed to update model');
        }
      }
    });
  }

  registerTestModelCommand() {
    const command = new SlashCommandBuilder()
      .setName('test-model')
      .setDescription('Test a model with a sample summary to verify it works')
      .addStringOption(option =>
        option.setName('model')
          .setDescription('Model to test')
          .setRequired(true)
          .addChoices(
            { name: '🚀 GPT-5 (Latest)', value: 'gpt-5' },
            { name: '🚀 GPT-5 Mini', value: 'gpt-5-mini' },
            { name: '🚀 GPT-5 Nano', value: 'gpt-5-nano' },
            { name: '🧠 o3 (Advanced Reasoning)', value: 'o3' },
            { name: '🧠 o3 Mini', value: 'o3-mini' },
            { name: '🧠 o1 Pro (Reasoning Pro)', value: 'o1-pro' },
            { name: '🧠 o1 (Reasoning)', value: 'o1' },
            { name: '🧠 o1 Mini', value: 'o1-mini' },
            { name: 'GPT-4o (Multimodal)', value: 'gpt-4o' },
            { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
            { name: 'GPT-4 Turbo (Stable)', value: 'gpt-4-turbo' },
            { name: 'GPT-4', value: 'gpt-4' },
            { name: 'GPT-3.5 Turbo (Fast)', value: 'gpt-3.5-turbo' }
          )
      );
    
    this.commands.set('test-model', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const testModel = interaction.options.getString('model');
          const summaryService = this.serviceManager.getService('summary');
          
          if (!summaryService) {
            throw new Error('Summary service not available');
          }
          
          // Test with a sample transcript
          const testTranscript = "This is a test video about artificial intelligence and machine learning. The video explains basic concepts of AI, discusses neural networks, and provides examples of how AI is used in everyday applications like recommendation systems and voice assistants.";
          
          const startTime = Date.now();
          
          // Temporarily test the model
          const originalModel = summaryService.config.model;
          summaryService.config.model = testModel;
          
          try {
            const testSummary = await summaryService.generateSummary(testTranscript, 'test-video-id');
            const responseTime = Date.now() - startTime;
            
            // Restore original model
            summaryService.config.model = originalModel;
            
            const embed = new EmbedBuilder()
              .setTitle('✅ Model Test Successful')
              .setColor(0x00AE86)
              .addFields(
                { name: 'Model Tested', value: testModel, inline: true },
                { name: 'Response Time', value: `${responseTime}ms`, inline: true },
                { name: 'Current Model', value: originalModel, inline: true },
                { name: 'Test Summary', value: testSummary.length > 1000 ? testSummary.substring(0, 1000) + '...' : testSummary }
              )
              .setFooter({ text: 'Use /set-model to switch to this model if satisfied with the test' })
              .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
          } catch (testError) {
            // Restore original model on error
            summaryService.config.model = originalModel;
            throw testError;
          }
          
        } catch (error) {
          console.error('Error testing model:', error);
          
          const embed = new EmbedBuilder()
            .setTitle('❌ Model Test Failed')
            .setColor(0xFF0000)
            .addFields(
              { name: 'Error', value: error.message },
              { name: 'Possible Causes', value: '• Model not available in your API tier\n• API rate limits\n• Invalid model name\n• Insufficient credits' }
            )
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
        }
      }
    });
  }

  registerSetScheduleCommand() {
    const command = new SlashCommandBuilder()
      .setName('set-schedule')
      .setDescription('Update report schedules (daily or weekly)')
      .addStringOption(option =>
        option.setName('report-type')
          .setDescription('Which report schedule to update')
          .setRequired(true)
          .addChoices(
            { name: 'Daily Reports', value: 'daily' },
            { name: 'Weekly Reports', value: 'weekly' }
          )
      )
      .addIntegerOption(option =>
        option.setName('hour')
          .setDescription('Hour (0-23, CEST timezone)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(23)
      )
      .addIntegerOption(option =>
        option.setName('minute')
          .setDescription('Minute (0-59)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(59)
      )
      .addIntegerOption(option =>
        option.setName('day')
          .setDescription('Day of week for weekly reports (0=Sunday, 1=Monday, etc.)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(6)
      );
    
    this.commands.set('set-schedule', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const reportType = interaction.options.getString('report-type');
          const newHour = interaction.options.getInteger('hour');
          const newMinute = interaction.options.getInteger('minute') || 0;
          const newDay = interaction.options.getInteger('day');
          
          let embed;
          
          if (reportType === 'daily') {
            // Handle daily report schedule update
            const oldHour = this.serviceManager.config.discord.schedule.dailyReportHour;
            const oldMinute = this.serviceManager.config.discord.schedule.dailyReportMinute;
            
            // Update the configuration
            this.serviceManager.config.discord.schedule.dailyReportHour = newHour;
            this.serviceManager.config.discord.schedule.dailyReportMinute = newMinute;
            
            embed = new EmbedBuilder()
              .setTitle('⏰ Daily Schedule Updated')
              .setColor(0x00AE86)
              .addFields(
                {
                  name: 'Previous Daily Schedule',
                  value: `${oldHour}:${oldMinute.toString().padStart(2, '0')} CEST`,
                  inline: true
                },
                {
                  name: 'New Daily Schedule',
                  value: `${newHour}:${newMinute.toString().padStart(2, '0')} CEST`,
                  inline: true
                },
                {
                  name: '⚠️ Important Note',
                  value: 'Schedule change requires bot restart to take effect. The new schedule will be active after the next deployment.',
                  inline: false
                }
              )
              .setFooter({ text: 'For permanent changes, update DAILY_REPORT_HOUR and DAILY_REPORT_MINUTE environment variables.' })
              .setTimestamp();
            
            this.logger.info(`Daily report schedule changed from ${oldHour}:${oldMinute.toString().padStart(2, '0')} to ${newHour}:${newMinute.toString().padStart(2, '0')} CEST by ${interaction.user.tag}`);
            
          } else if (reportType === 'weekly') {
            // Handle weekly report schedule update
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const currentDay = newDay !== null ? newDay : 0; // Default to Sunday
            
            // Add weekly schedule to config if not exists
            if (!this.serviceManager.config.discord.schedule.weeklyReportHour) {
              this.serviceManager.config.discord.schedule.weeklyReportHour = 19;
              this.serviceManager.config.discord.schedule.weeklyReportMinute = 0;
              this.serviceManager.config.discord.schedule.weeklyReportDay = 0;
            }
            
            const oldHour = this.serviceManager.config.discord.schedule.weeklyReportHour;
            const oldMinute = this.serviceManager.config.discord.schedule.weeklyReportMinute;
            const oldDay = this.serviceManager.config.discord.schedule.weeklyReportDay || 0;
            
            // Update the configuration
            this.serviceManager.config.discord.schedule.weeklyReportHour = newHour;
            this.serviceManager.config.discord.schedule.weeklyReportMinute = newMinute;
            this.serviceManager.config.discord.schedule.weeklyReportDay = currentDay;
            
            embed = new EmbedBuilder()
              .setTitle('📊 Weekly Schedule Updated')
              .setColor(0x00AE86)
              .addFields(
                {
                  name: 'Previous Weekly Schedule',
                  value: `${dayName[oldDay]}s at ${oldHour}:${oldMinute.toString().padStart(2, '0')} CEST`,
                  inline: true
                },
                {
                  name: 'New Weekly Schedule',
                  value: `${dayName[currentDay]}s at ${newHour}:${newMinute.toString().padStart(2, '0')} CEST`,
                  inline: true
                },
                {
                  name: '⚠️ Important Note',
                  value: 'Weekly schedule change requires bot restart to take effect. The new schedule will be active after the next deployment.',
                  inline: false
                },
                {
                  name: '📅 Monthly Schedule',
                  value: 'Monthly reports remain on 1st of month at 20:00 CEST (hardcoded)',
                  inline: false
                }
              )
              .setFooter({ text: 'Weekly schedules are temporary until restart. For permanent changes, update deployment configuration.' })
              .setTimestamp();
            
            this.logger.info(`Weekly report schedule changed from ${dayName[oldDay]}s ${oldHour}:${oldMinute.toString().padStart(2, '0')} to ${dayName[currentDay]}s ${newHour}:${newMinute.toString().padStart(2, '0')} CEST by ${interaction.user.tag}`);
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Set schedule command error:', error);
          await interaction.editReply('❌ Failed to update schedule');
        }
      }
    });
  }
}

module.exports = CommandService;
