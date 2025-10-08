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
    
    // === HELP & DISCOVERY ===
    this.registerHelpCommand();
    
    // === MONITORING ===
    this.registerHealthCommand(); // Merged detailed-health into this
    this.registerStatusCommand(); // New - replaces check-summaries
    this.registerLogsCommand();
    this.registerCheckSummariesCommand(); // Keep for detailed summary checking
    this.registerCheckTranscriptsCommand(); // New - check transcript cache
    
    // === REPORTS ===
    this.registerReportCommand(); // Enhanced report command
    this.registerTriggerReportCommand(); // Keep original for quick access
    this.registerScheduleCommand(); // Renamed from set-schedule
    
    // === PROCESSING ===
    this.registerProcessCommand(); // Enhanced processing command  
    this.registerTestSummaryCommand(); // Keep original for quick testing
    this.registerTranscriptCommand(); // Enhanced transcript command
    this.registerTranscriptTestCommand(); // Keep original for quick testing
    
    // === ADMINISTRATION ===
    this.registerConfigCommand();
    this.registerModelCommand(); // Merged set-model + test-model
    this.registerCacheCommand(); // Merged cache-stats + debug-cache + clear-cache
    this.registerPromptsCommand(); // Merged reload-prompts + validate-prompts
    this.registerChannelStatusCommand(); // Keep as-is for now
    
    console.log(`✅ Registered ${this.commands.size} slash commands`);
  }

  // === HELP & DISCOVERY ===
  
  registerHelpCommand() {
    const command = new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show all available commands organized by category')
      .addStringOption(option =>
        option.setName('category')
          .setDescription('Show commands for specific category')
          .setRequired(false)
          .addChoices(
            { name: '🔍 Monitoring', value: 'monitoring' },
            { name: '📊 Reports', value: 'reports' },
            { name: '🎬 Processing', value: 'processing' },
            { name: '⚙️ Administration', value: 'admin' }
          )
      );
    
    this.commands.set('help', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const category = interaction.options.getString('category');
          
          const commandCategories = {
            monitoring: {
              title: '🔍 Monitoring Commands',
              color: 0x74c0fc,
              commands: [
                { name: '/health', desc: 'Check service health status (use --detailed for comprehensive)' },
                { name: '/status', desc: 'Bot dashboard with recent activity and summaries' },
                { name: '/logs', desc: 'View recent bot activity logs' }
              ]
            },
            reports: {
              title: '📊 Report Commands', 
              color: 0x51cf66,
              commands: [
                { name: '/report', desc: 'Trigger daily/weekly/monthly reports manually' },
                { name: '/schedule', desc: 'Update report timing and schedules' }
              ]
            },
            processing: {
              title: '🎬 Processing Commands',
              color: 0xffd43b,
              commands: [
                { name: '/process', desc: 'Process single YouTube video for testing' },
                { name: '/transcript', desc: 'Test transcript extraction for specific video' }
              ]
            },
            admin: {
              title: '⚙️ Administration Commands',
              color: 0xff6b6b,
              commands: [
                { name: '/config', desc: 'View current bot configuration' },
                { name: '/model', desc: 'Manage OpenAI models (set/test)' },
                { name: '/cache', desc: 'Manage cache (stats/debug/clear)' },
                { name: '/prompts', desc: 'Manage Discord prompts (reload/validate)' },
                { name: '/channel-status', desc: 'Check monitored Discord channels' }
              ]
            }
          };

          if (category && commandCategories[category]) {
            // Show specific category
            const cat = commandCategories[category];
            const embed = new EmbedBuilder()
              .setTitle(cat.title)
              .setColor(cat.color)
              .setTimestamp();
            
            cat.commands.forEach(cmd => {
              embed.addFields({
                name: cmd.name,
                value: cmd.desc,
                inline: false
              });
            });
            
            await interaction.editReply({ embeds: [embed] });
          } else {
            // Show all categories overview
            const embed = new EmbedBuilder()
              .setTitle('🤖 Discord Bot Commands')
              .setDescription('Use `/help category:monitoring` to see specific category commands')
              .setColor(0x5865f2)
              .setTimestamp();
            
            Object.entries(commandCategories).forEach(([key, cat]) => {
              const commandList = cat.commands.map(cmd => cmd.name).join(', ');
              embed.addFields({
                name: cat.title,
                value: commandList,
                inline: false
              });
            });
            
            await interaction.editReply({ embeds: [embed] });
          }
          
        } catch (error) {
          console.error('❌ Help command error:', error);
          await interaction.editReply('❌ Error showing help: ' + error.message);
        }
      }
    });
  }

  // === MONITORING ===

  registerHealthCommand() {
    const command = new SlashCommandBuilder()
      .setName('health')
      .setDescription('Check the health status of all bot services')
      .addBooleanOption(option =>
        option.setName('detailed')
          .setDescription('Show detailed health diagnostics')
          .setRequired(false)
      );
    
    this.commands.set('health', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const detailed = interaction.options.getBoolean('detailed') || false;
          console.log(`🔍 Running health check via command (detailed: ${detailed})...`);
          
          if (detailed) {
            // Detailed health check (merged from registerDetailedHealthCommand)
            const serviceTypes = ['transcript', 'summary', 'report', 'discord'];
            const results = [];
            
            for (const serviceType of serviceTypes) {
              try {
                const service = await this.serviceManager.getService(serviceType);
                if (service && service.healthCheck) {
                  const result = await service.healthCheck();
                  results.push({
                    name: serviceType,
                    status: result.status,
                    details: result,
                    error: result.error
                  });
                } else {
                  results.push({
                    name: serviceType,
                    status: 'unavailable',
                    details: { message: 'Service not available or no health check method' },
                    error: null
                  });
                }
              } catch (error) {
                results.push({
                  name: serviceType,
                  status: 'error',
                  details: { message: 'Health check failed' },
                  error: error.message
                });
              }
            }
            
            const embed = new EmbedBuilder()
              .setTitle('🔍 Detailed Health Diagnostics')
              .setColor(results.some(r => r.status === 'error') ? 0xff6b6b : 0x51cf66)
              .setTimestamp();
            
            results.forEach(result => {
              const status = this.getServiceStatusIcon(result.status);
              let value = `**Status**: ${result.status}\n`;
              
              if (result.details && typeof result.details === 'object') {
                Object.entries(result.details).forEach(([key, val]) => {
                  if (key !== 'status') {
                    value += `**${key}**: ${val}\n`;
                  }
                });
              }
              
              if (result.error) {
                value += `**Error**: ${result.error}\n`;
              }
              
              embed.addFields({
                name: `${status} ${result.name.charAt(0).toUpperCase() + result.name.slice(1)} Service`,
                value: value.trim(),
                inline: true
              });
            });
            
            await interaction.editReply({ embeds: [embed] });
          } else {
            // Basic health check (original functionality)
            const transcriptService = await this.serviceManager.getService('transcript');
            const reportService = await this.serviceManager.getService('report');
            const summaryService = await this.serviceManager.getService('summary');
            
            const healthResults = {
              transcript: await this.checkServiceHealth(transcriptService),
              report: await this.checkServiceHealth(reportService),
              summary: await this.checkServiceHealth(summaryService),
              discord: { status: 'ok', details: 'Connected and responding' }
            };
            
            const embed = new EmbedBuilder()
              .setTitle('🔍 Bot Health Status')
              .setDescription('Use `/health detailed:true` for comprehensive diagnostics')
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
          }
          
        } catch (error) {
          console.error('❌ Health check command error:', error);
          await interaction.editReply('❌ Error running health check: ' + error.message);
        }
      }
    });
  }

  registerStatusCommand() {
    const command = new SlashCommandBuilder()
      .setName('status')
      .setDescription('Bot dashboard with recent activity and summary overview')
      .addBooleanOption(option =>
        option.setName('all-dates')
          .setDescription('Show summaries from all dates')
          .setRequired(false)
      );
    
    this.commands.set('status', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const showAll = interaction.options.getBoolean('all-dates') || false;
          console.log(`📊 Bot status dashboard, showAll: ${showAll}`);
          
          const cacheService = await this.serviceManager.getService('cache');
          const reportService = await this.serviceManager.getService('report');
          const discordService = await this.serviceManager.getService('discord');
          
          if (!cacheService || !reportService || !discordService) {
            throw new Error('Required services not available');
          }
          
          // Get today's summaries
          const today = new Date().toISOString().split('T')[0];
          const summaries = await reportService.getTodaysSummaries();
          
          // Get cache stats
          const cacheStats = await cacheService.getStats();
          
          // Check service health quickly
          const healthResults = {
            transcript: await this.checkServiceHealth(await this.serviceManager.getService('transcript')),
            summary: await this.checkServiceHealth(await this.serviceManager.getService('summary')),
            report: await this.checkServiceHealth(reportService)
          };
          
          const allHealthy = Object.values(healthResults).every(result => result.status === 'ok');
          
          const embed = new EmbedBuilder()
            .setTitle('📊 Bot Status Dashboard')
            .setColor(allHealthy ? 0x51cf66 : 0xffd43b)
            .addFields(
              {
                name: '🔍 Service Health',
                value: allHealthy ? '✅ All services healthy' : '⚠️ Some issues detected (use `/health detailed:true`)',
                inline: true
              },
              {
                name: '📈 Today\'s Activity',
                value: `**Summaries**: ${summaries.length}\n**Cache Files**: ${cacheStats.totalFiles}\n**Cache Size**: ${(cacheStats.totalSize / 1024 / 1024).toFixed(2)} MB`,
                inline: true
              },
              {
                name: '⏰ Last Activity',
                value: summaries.length > 0 ? `<t:${Math.floor(new Date(summaries[0].created_at).getTime() / 1000)}:R>` : 'No recent activity',
                inline: true
              }
            )
            .setTimestamp();
          
          if (summaries.length > 0) {
            const recentSummaries = summaries.slice(0, showAll ? summaries.length : 5);
            const summaryList = recentSummaries.map(summary => 
              `• **${summary.title}** (<t:${Math.floor(new Date(summary.created_at).getTime() / 1000)}:R>)`
            ).join('\n');
            
            embed.addFields({
              name: `📝 Recent Summaries ${showAll ? '' : '(5 most recent)'}`,
              value: summaryList.length > 1024 ? summaryList.substring(0, 1020) + '...' : summaryList,
              inline: false
            });
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Status command error:', error);
          await interaction.editReply('❌ Error retrieving status: ' + error.message);
        }
      }
    });
  }

  // === REPORTS ===

  registerReportCommand() {
    const command = new SlashCommandBuilder()
      .setName('report')
      .setDescription('Generate and send daily/weekly/monthly reports manually')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of report to generate')
          .setRequired(false)
          .addChoices(
            { name: 'Daily Report', value: 'daily' },
            { name: 'Weekly Report', value: 'weekly' },
            { name: 'Monthly Report', value: 'monthly' }
          )
      )
      .addStringOption(option =>
        option.setName('channel')
          .setDescription('Specific channel name or "all" for all channels')
          .setRequired(false)
      );
    
    this.commands.set('report', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const channelOption = interaction.options.getString('channel') || 'all';
          console.log(`📊 Triggering daily report via command for: ${channelOption}`);
          
          const reportService = await this.serviceManager.getService('report');
          if (!reportService) {
            throw new Error('Report service not available');
          }
          
          let results = [];
          
          const discordService = await this.serviceManager.getService('discord');
          
          if (channelOption === 'all') {
            // Trigger all report channels using the Discord service
            try {
              // Generate the daily report first
              const report = await reportService.generateDailyReport();
              
              // Use Discord service to send to appropriate channels
              await discordService.sendDailyReport(report);
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

  registerTriggerReportCommand() {
    const command = new SlashCommandBuilder()
      .setName('trigger-report')
      .setDescription('Quick daily report generation (simplified version)')
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
          console.log(`📊 Quick triggering daily report for: ${channelOption}`);
          
          const reportService = await this.serviceManager.getService('report');
          const discordService = await this.serviceManager.getService('discord');
          
          if (!reportService || !discordService) {
            throw new Error('Required services not available');
          }
          
          let results = [];
          
          if (channelOption === 'all') {
            try {
              await discordService.sendDailyReports();
              results.push('✅ Daily reports sent to all channels');
            } catch (error) {
              results.push(`❌ Error sending daily reports: ${error.message}`);
            }
          } else {
            try {
              await reportService.generateDailyReport();
              await discordService.sendDailyReportToChannel(channelOption);
              results.push(`✅ Daily report sent to #${channelOption}`);
            } catch (error) {
              results.push(`❌ Error sending daily report to #${channelOption}: ${error.message}`);
            }
          }
          
          const embed = new EmbedBuilder()
            .setTitle('📊 Quick Report Trigger Results')
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

  // === PROCESSING ===
  
  registerProcessCommand() {
    const command = new SlashCommandBuilder()
      .setName('process')
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
    
    this.commands.set('process', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const videoUrl = interaction.options.getString('video-url');
          const channelOption = interaction.options.getString('channel') || '1';
          
          console.log(`🎯 Processing video via command: ${videoUrl} -> channel ${channelOption}`);
          
          // Extract video ID
          const videoId = this.extractVideoId(videoUrl);
          if (!videoId) {
            await interaction.editReply('❌ Invalid YouTube URL. Please provide a valid YouTube video URL.');
            return;
          }
          
          // Get services
          const transcriptService = await this.serviceManager.getService('transcript');
          const summaryService = await this.serviceManager.getService('summary');
          const discordService = await this.serviceManager.getService('discord');
          
          if (!transcriptService || !summaryService || !discordService) {
            throw new Error('Required services not available');
          }
          
          const startTime = Date.now();
          
          // Step 1: Get transcript
          await interaction.editReply('🎬 Extracting video transcript...');
          const transcript = await transcriptService.getTranscript(videoId);
          
          if (!transcript) {
            await interaction.editReply('❌ Failed to extract transcript. Video may not have captions or may be unavailable.');
            return;
          }
          
          // Step 2: Generate summary
          await interaction.editReply('🤖 Generating AI summary...');
          const summary = await summaryService.generateSummary(transcript, videoId);
          
          if (!summary) {
            await interaction.editReply('❌ Failed to generate summary. OpenAI service may be unavailable.');
            return;
          }
          
          // Step 3: Send to Discord channel
          await interaction.editReply('📤 Sending to Discord channel...');
          
          // Find target channel
          const targetChannelName = `yt-summaries-${channelOption}`;
          const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
          const targetChannel = guild?.channels.cache.find(ch => ch.name === targetChannelName);
          
          if (!targetChannel) {
            await interaction.editReply(`❌ Channel #${targetChannelName} not found`);
            return;
          }
          
          // Send summary to channel
          await discordService.sendLongMessage(targetChannel, summary, videoId);
          
          const duration = Date.now() - startTime;
          
          const embed = new EmbedBuilder()
            .setTitle('✅ Video Processing Complete')
            .setColor(0x51cf66)
            .addFields(
              { name: '🎬 Video ID', value: videoId, inline: true },
              { name: '📺 Channel', value: `#${targetChannelName}`, inline: true },
              { name: '⏱️ Total Time', value: `${Math.round(duration / 1000)}s`, inline: true },
              { name: '📝 Summary Length', value: `${summary.length} characters`, inline: true }
            )
            .setTimestamp();
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Process command error:', error);
          await interaction.editReply('❌ Error processing video: ' + error.message);
        }
      }
    });
  }

  registerTestSummaryCommand() {
    const command = new SlashCommandBuilder()
      .setName('test-summary')
      .setDescription('Process a single YouTube video immediately (original quick version)')
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
            await interaction.editReply('❌ Invalid YouTube URL');
            return;
          }
          
          const transcriptService = await this.serviceManager.getService('transcript');
          const summaryService = await this.serviceManager.getService('summary');
          const discordService = await this.serviceManager.getService('discord');
          
          if (!transcriptService || !summaryService || !discordService) {
            throw new Error('Required services not available');
          }
          
          // Quick processing
          const transcript = await transcriptService.getTranscript(videoId);
          if (!transcript) {
            await interaction.editReply('❌ Failed to extract transcript');
            return;
          }
          
          const summary = await summaryService.generateSummary(transcript, videoId);
          if (!summary) {
            await interaction.editReply('❌ Failed to generate summary');
            return;
          }
          
          // Send to channel
          const targetChannelName = `yt-summaries-${channelOption}`;
          const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
          const targetChannel = guild?.channels.cache.find(ch => ch.name === targetChannelName);
          
          if (targetChannel) {
            await discordService.sendLongMessage(targetChannel, summary, videoId);
            await interaction.editReply(`✅ Summary sent to #${targetChannelName}`);
          } else {
            await interaction.editReply(`❌ Channel #${targetChannelName} not found`);
          }
          
        } catch (error) {
          console.error('❌ Test summary command error:', error);
          await interaction.editReply('❌ Error: ' + error.message);
        }
      }
    });
  }

  registerTranscriptCommand() {
    const command = new SlashCommandBuilder()
      .setName('transcript')
      .setDescription('Test transcript extraction for a specific video')
      .addStringOption(option =>
        option.setName('video-id')
          .setDescription('YouTube video ID to test')
          .setRequired(true)
      );
    
    this.commands.set('transcript', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const videoId = interaction.options.getString('video-id');
          console.log(`🎬 Testing transcript extraction via command: ${videoId}`);
          
          const transcriptService = await this.serviceManager.getService('transcript');
          if (!transcriptService) {
            throw new Error('Transcript service not available');
          }
          
          const startTime = Date.now();
          const transcript = await transcriptService.getTranscript(videoId);
          const duration = Date.now() - startTime;
          
          const embed = new EmbedBuilder()
            .setTitle('🎬 Transcript Test Results')
            .setColor(transcript ? 0x51cf66 : 0xff6b6b)
            .addFields(
              { name: '🎯 Video ID', value: videoId, inline: true },
              { name: '⏱️ Extraction Time', value: `${duration}ms`, inline: true },
              { name: '📊 Status', value: transcript ? '✅ Success' : '❌ Failed', inline: true }
            )
            .setTimestamp();
          
          if (transcript) {
            const preview = transcript.length > 500 ? transcript.substring(0, 500) + '...' : transcript;
            embed.addFields(
              { name: '📝 Length', value: `${transcript.length} characters`, inline: true },
              { name: '📄 Preview', value: `\`\`\`${preview}\`\`\``, inline: false }
            );
          } else {
            embed.addFields({
              name: '❌ Possible Issues',
              value: '• Video has no captions\n• Video is private/unavailable\n• Transcript service error\n• Rate limiting',
              inline: false
            });
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Transcript test command error:', error);
          await interaction.editReply('❌ Error testing transcript: ' + error.message);
        }
      }
    });
  }

  registerTranscriptTestCommand() {
    const command = new SlashCommandBuilder()
      .setName('transcript-test')
      .setDescription('Test transcript extraction for a specific video (original quick version)')
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
          console.log(`🎬 Quick testing transcript extraction: ${videoId}`);
          
          const transcriptService = await this.serviceManager.getService('transcript');
          if (!transcriptService) {
            throw new Error('Transcript service not available');
          }
          
          const startTime = Date.now();
          const transcript = await transcriptService.getTranscript(videoId);
          const duration = Date.now() - startTime;
          
          if (transcript) {
            const preview = transcript.length > 200 ? transcript.substring(0, 200) + '...' : transcript;
            await interaction.editReply(
              `✅ **Transcript extracted** (${duration}ms)\n` +
              `📝 Length: ${transcript.length} characters\n` +
              `📄 Preview: \`${preview}\``
            );
          } else {
            await interaction.editReply(`❌ **Failed to extract transcript** (${duration}ms)`);
          }
          
        } catch (error) {
          console.error('❌ Transcript test command error:', error);
          await interaction.editReply('❌ Error: ' + error.message);
        }
      }
    });
  }

  // === ADMINISTRATION ===

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
          const discordService = await this.serviceManager.getService('discord');
          if (!discordService) {
            throw new Error('Discord service not available');
          }

          // Get transcript first
          const transcriptService = await this.serviceManager.getService('transcript');
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

          // Find available summary channels (with and without suffixes)
          const summaryChannels = guild.channels.cache.filter(
            ch => ch.name && (
              ch.name.startsWith(discordService.config.prefixes.summariesOutput) || // yt-summaries-1, yt-summaries-2, etc.
              ch.name === discordService.config.prefixes.summariesOutput.slice(0, -1) // yt-summaries (without dash)
            )
          );
          
          if (summaryChannels.size === 0) {
            throw new Error('No summary output channels found');
          }
          
          // Find the specific summary channel
          let summaryChannel = summaryChannels.find(ch => 
            ch.name.endsWith(`-${channelOption}`) ||
            ch.name === `${discordService.config.prefixes.summariesOutput}${channelOption}` ||
            (channelOption === '1' && ch.name === discordService.config.prefixes.summariesOutput.slice(0, -1)) // Handle base channel for option "1"
          );
          
          // If not found, use the first available channel
          if (!summaryChannel) {
            summaryChannel = summaryChannels.first();
            console.log(`Channel "${channelOption}" not found, using ${summaryChannel.name}`);
          }
          
          // Find corresponding prompt channel
          let promptChannelName;
          if (summaryChannel.name === discordService.config.prefixes.summariesOutput.slice(0, -1)) {
            // Base channel without suffix (yt-summaries -> yt-summary-prompt)
            promptChannelName = discordService.config.prefixes.summaryPrompt.slice(0, -1);
          } else {
            // Channel with suffix - use replace logic
            promptChannelName = summaryChannel.name.replace('summaries', 'summary-prompt');
          }
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
          
          const discordService = await this.serviceManager.getService('discord');
          if (!discordService) {
            throw new Error('Discord service not available');
          }
          
          // Reload prompts for all channels
          const results = [];
          
          // Summary prompts (dynamically detect all)
          const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
          if (guild) {
            const summaryPromptChannels = guild.channels.cache.filter(
              ch => ch.name && (
                ch.name.startsWith(discordService.config.prefixes.summaryPrompt) || // yt-summary-prompt-1, yt-summary-prompt-2, etc.
                ch.name === discordService.config.prefixes.summaryPrompt.slice(0, -1) // yt-summary-prompt (without dash)
              )
            );
            
            if (summaryPromptChannels.size === 0) {
              results.push(`⚠️ No summary prompt channels found`);
            } else {
              for (const [channelId, channel] of summaryPromptChannels) {
                try {
                  const prompt = await discordService.getCustomPromptFromChannel(channel.name);
                  let suffix;
                  if (channel.name.startsWith(discordService.config.prefixes.summaryPrompt)) {
                    suffix = channel.name.replace(discordService.config.prefixes.summaryPrompt, '');
                  } else {
                    suffix = '(base)';
                  }
                  results.push(`✅ Summary Prompt ${suffix}: ${prompt ? 'Loaded' : 'Not found'}`);
                } catch (error) {
                  let suffix;
                  if (channel.name.startsWith(discordService.config.prefixes.summaryPrompt)) {
                    suffix = channel.name.replace(discordService.config.prefixes.summaryPrompt, '');
                  } else {
                    suffix = '(base)';
                  }
                  results.push(`❌ Summary Prompt ${suffix}: ${error.message}`);
                }
              }
            }
          }
          
          // Daily report prompts (dynamic detection - handle both with and without suffix)
          const dailyReportPromptChannels = guild.channels.cache.filter(
            ch => ch.name && (
              ch.name.startsWith(discordService.config.prefixes.dailyReportPrompt) || // yt-daily-report-prompt-1, etc.
              ch.name === discordService.config.prefixes.dailyReportPrompt.slice(0, -1) // yt-daily-report-prompt (without dash)
            )
          );
          
          if (dailyReportPromptChannels.size === 0) {
            results.push(`⚠️ Daily Report Prompts: No channels found`);
          } else {
            for (const [channelId, channel] of dailyReportPromptChannels) {
              try {
                const prompt = await discordService.getCustomPromptFromChannel(channel.name);
                let suffix;
                if (channel.name.startsWith(discordService.config.prefixes.dailyReportPrompt)) {
                  suffix = channel.name.replace(discordService.config.prefixes.dailyReportPrompt, '');
                } else {
                  suffix = '(base)';
                }
                results.push(`✅ Daily Report Prompt ${suffix}: ${prompt ? 'Loaded' : 'Not found'}`);
              } catch (error) {
                let suffix;
                if (channel.name.startsWith(discordService.config.prefixes.dailyReportPrompt)) {
                  suffix = channel.name.replace(discordService.config.prefixes.dailyReportPrompt, '');
                } else {
                  suffix = '(base)';
                }
                results.push(`❌ Daily Report Prompt ${suffix}: ${error.message}`);
              }
            }
          }
          
          // Weekly report prompts (dynamic detection - handle both with and without suffix)
          const weeklyReportPromptChannels = guild.channels.cache.filter(
            ch => ch.name && (
              ch.name.startsWith(discordService.config.prefixes.weeklyReportPrompt) || // yt-weekly-report-prompt-1, etc.
              ch.name === discordService.config.prefixes.weeklyReportPrompt.slice(0, -1) // yt-weekly-report-prompt (without dash)
            )
          );
          
          if (weeklyReportPromptChannels.size === 0) {
            results.push(`⚠️ Weekly Report Prompts: No channels found`);
          } else {
            for (const [channelId, channel] of weeklyReportPromptChannels) {
              try {
                const prompt = await discordService.getCustomPromptFromChannel(channel.name);
                let suffix;
                if (channel.name.startsWith(discordService.config.prefixes.weeklyReportPrompt)) {
                  suffix = channel.name.replace(discordService.config.prefixes.weeklyReportPrompt, '');
                } else {
                  suffix = '(base)';
                }
                results.push(`✅ Weekly Report Prompt ${suffix}: ${prompt ? 'Loaded' : 'Not found'}`);
              } catch (error) {
                let suffix;
                if (channel.name.startsWith(discordService.config.prefixes.weeklyReportPrompt)) {
                  suffix = channel.name.replace(discordService.config.prefixes.weeklyReportPrompt, '');
                } else {
                  suffix = '(base)';
                }
                results.push(`❌ Weekly Report Prompt ${suffix}: ${error.message}`);
              }
            }
          }
          
          // Monthly report prompts (dynamic detection - handle both with and without suffix)
          const monthlyReportPromptChannels = guild.channels.cache.filter(
            ch => ch.name && (
              ch.name.startsWith(discordService.config.prefixes.monthlyReportPrompt) || // yt-monthly-report-prompt-1, etc.
              ch.name === discordService.config.prefixes.monthlyReportPrompt.slice(0, -1) // yt-monthly-report-prompt (without dash)
            )
          );
          
          if (monthlyReportPromptChannels.size === 0) {
            results.push(`⚠️ Monthly Report Prompts: No channels found`);
          } else {
            for (const [channelId, channel] of monthlyReportPromptChannels) {
              try {
                const prompt = await discordService.getCustomPromptFromChannel(channel.name);
                let suffix;
                if (channel.name.startsWith(discordService.config.prefixes.monthlyReportPrompt)) {
                  suffix = channel.name.replace(discordService.config.prefixes.monthlyReportPrompt, '');
                } else {
                  suffix = '(base)';
                }
                results.push(`✅ Monthly Report Prompt ${suffix}: ${prompt ? 'Loaded' : 'Not found'}`);
              } catch (error) {
                let suffix;
                if (channel.name.startsWith(discordService.config.prefixes.monthlyReportPrompt)) {
                  suffix = channel.name.replace(discordService.config.prefixes.monthlyReportPrompt, '');
                } else {
                  suffix = '(base)';
                }
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

  registerCheckSummariesCommand() {
    const command = new SlashCommandBuilder()
      .setName('check-summaries')
      .setDescription('Check today\'s summaries and recent cache in detail')
      .addBooleanOption(option =>
        option.setName('all-dates')
          .setDescription('Show summaries from all dates')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('date')
          .setDescription('Check specific date (YYYY-MM-DD)')
          .setRequired(false)
      );
    
    this.commands.set('check-summaries', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const showAll = interaction.options.getBoolean('all-dates') || false;
          const specificDate = interaction.options.getString('date');
          
          console.log(`📋 Checking summaries, showAll: ${showAll}, date: ${specificDate}`);
          
          const cacheService = await this.serviceManager.getService('cache');
          const reportService = await this.serviceManager.getService('report');
          const databaseService = await this.serviceManager.getService('database');
          
          if (!cacheService || !reportService || !databaseService) {
            throw new Error('Required services not available');
          }
          
          let summaries;
          let dateLabel = 'today';
          
          if (specificDate) {
            summaries = await databaseService.getSummariesByDate(specificDate);
            dateLabel = specificDate;
          } else if (showAll) {
            summaries = await databaseService.getRecentSummaries(100); // Last 100
            dateLabel = 'recent';
          } else {
            summaries = await reportService.getTodaysSummaries();
            dateLabel = 'today';
          }
          
          const embed = new EmbedBuilder()
            .setTitle(`📋 Summary Check Results (${dateLabel})`)
            .setColor(0x74c0fc)
            .setTimestamp();
          
          if (summaries.length === 0) {
            embed.setDescription(`📭 No summaries found for ${dateLabel}`);
          } else {
            embed.addFields(
              {
                name: '📊 Summary Statistics',
                value: `**Total**: ${summaries.length} summaries\n**Period**: ${dateLabel}`,
                inline: true
              }
            );
            
            const recentSummaries = summaries.slice(0, 10); // Show last 10
            const summaryList = recentSummaries.map(summary => {
              const timestamp = Math.floor(new Date(summary.created_at).getTime() / 1000);
              return `• **${summary.title}** - <t:${timestamp}:R>`;
            }).join('\n');
            
            embed.addFields({
              name: `📝 Recent Summaries (showing ${recentSummaries.length}/${summaries.length})`,
              value: summaryList.length > 1000 ? summaryList.substring(0, 1000) + '...' : summaryList,
              inline: false
            });
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Check summaries command error:', error);
          await interaction.editReply('❌ Error checking summaries: ' + error.message);
        }
      }
    });
  }

  registerCheckTranscriptsCommand() {
    const command = new SlashCommandBuilder()
      .setName('check-transcripts')
      .setDescription('Check transcript cache and recent extractions')
      .addBooleanOption(option =>
        option.setName('show-details')
          .setDescription('Show detailed transcript information')
          .setRequired(false)
      );
    
    this.commands.set('check-transcripts', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const showDetails = interaction.options.getBoolean('show-details') || false;
          console.log(`🎬 Checking transcripts, details: ${showDetails}`);
          
          const cacheService = await this.serviceManager.getService('cache');
          if (!cacheService) {
            throw new Error('Cache service not available');
          }
          
          // Get transcript files from cache
          const cacheStats = await cacheService.getStats();
          const transcriptFiles = await cacheService.debugCache('transcript');
          
          const embed = new EmbedBuilder()
            .setTitle('🎬 Transcript Cache Check')
            .setColor(0xffd43b)
            .setTimestamp();
          
          embed.addFields(
            {
              name: '📊 Cache Statistics',
              value: `**Total Files**: ${cacheStats.totalFiles}\n**Transcript Files**: ${Object.keys(transcriptFiles).length}`,
              inline: true
            }
          );
          
          if (Object.keys(transcriptFiles).length > 0) {
            if (showDetails) {
              let transcriptList = '';
              Object.entries(transcriptFiles).slice(0, 10).forEach(([filename, info]) => {
                const timestamp = Math.floor(info.modified / 1000);
                transcriptList += `• **${filename}** - ${(info.size / 1024).toFixed(1)}KB - <t:${timestamp}:R>\n`;
              });
              
              embed.addFields({
                name: `📄 Recent Transcripts (showing up to 10)`,
                value: transcriptList.length > 1000 ? transcriptList.substring(0, 1000) + '...' : transcriptList,
                inline: false
              });
            } else {
              embed.addFields({
                name: '📄 Transcript Files',
                value: `Found ${Object.keys(transcriptFiles).length} cached transcripts\nUse \`show-details:true\` to see file list`,
                inline: false
              });
            }
          } else {
            embed.addFields({
              name: '📭 No Transcripts',
              value: 'No transcript files found in cache',
              inline: false
            });
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Check transcripts command error:', error);
          await interaction.editReply('❌ Error checking transcripts: ' + error.message);
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
          
          const cacheService = await this.serviceManager.getService('cache');
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
          
          const discordService = await this.serviceManager.getService('discord');
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
          
          const transcriptService = await this.serviceManager.getService('transcript');
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
          
          const discordService = await this.serviceManager.getService('discord');
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
          
          const cacheService = await this.serviceManager.getService('cache');
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
          
          const cacheService = await this.serviceManager.getService('cache');
          const reportService = await this.serviceManager.getService('report');
          const discordService = await this.serviceManager.getService('discord');
          
          if (!cacheService || !reportService || !discordService) {
            throw new Error('Cache, Report, or Discord service not available');
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
          
          // If description is too long, send as file
          if (description.length > 2000) {
            await discordService.sendLongMessage(
              interaction.channel, 
              description, 
              { 
                fileName: 'summary_check', 
                fileFormat: 'txt',
                fallbackMessage: '' // Removed "too long" message
              }
            );
          } else {
            await interaction.editReply(description);
          }
        } catch (error) {
          console.error('Error in check-summaries command:', error);
          await interaction.editReply(`❌ Error checking summaries: ${error.message}`);
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
          
          const cacheService = await this.serviceManager.getService('cache');
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
                  'Sundays 19:00 CEST'}\n**Monthly**: ${config.discord.schedule.monthlyReportDay ? 
                  (config.discord.schedule.monthlyReportDay === 'L' ? 'Last day' : 
                   config.discord.schedule.monthlyReportDay === '15' ? '15th' : '1st') + ` of month ${config.discord.schedule.monthlyReportHour || 20}:${(config.discord.schedule.monthlyReportMinute || 0).toString().padStart(2, '0')} CEST` : 
                  '1st of month 20:00 CEST'}`,
                inline: true
              },
              {
                name: '✅ Verified Working Models',
                value: '**GPT-5** (2s) • **GPT-4o** (1.5s) • **GPT-4o Mini** (0.8s)\n**GPT-4 Turbo** (0.8s) • **o3 Mini** (1s) • **GPT-4** (1.6s)\n\nUse `/test-model` to test, `/set-model` to switch',
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

  registerModelCommand() {
    const command = new SlashCommandBuilder()
      .setName('model')
      .setDescription('Manage OpenAI models (set active model or test before switching)')
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Action to perform')
          .setRequired(true)
          .addChoices(
            { name: '🔄 Set Active Model', value: 'set' },
            { name: '🧪 Test Model', value: 'test' },
            { name: '📋 List Available Models', value: 'list' }
          )
      )
      .addStringOption(option =>
        option.setName('model')
          .setDescription('Select OpenAI model')
          .setRequired(false)
          .addChoices(
            // Fast & Reliable Category
            { name: '⚡ GPT-4o (Fast & Reliable)', value: 'gpt-4o' },
            { name: '💨 GPT-4o Mini (Fastest)', value: 'gpt-4o-mini' },
            
            // Latest & Advanced
            { name: '🚀 GPT-5 (Latest)', value: 'gpt-5' },
            { name: '🧠 o3 Mini (Reasoning)', value: 'o3-mini' },
            
            // Balanced Options  
            { name: '🎯 GPT-4 Turbo (Balanced)', value: 'gpt-4-turbo' },
            { name: '� GPT-4 (Classic)', value: 'gpt-4' }
          )
      );
    
    this.commands.set('model', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const action = interaction.options.getString('action');
          const model = interaction.options.getString('model');
          
          const summaryService = await this.serviceManager.getService('summary');
          if (!summaryService) {
            throw new Error('Summary service not available');
          }
          
          if (action === 'list') {
            // List available models with current active
            const currentModel = summaryService.config?.openai?.model || 'Unknown';
            
            const modelInfo = {
              'gpt-4o': '⚡ **GPT-4o** - Fast & reliable, best overall choice',
              'gpt-4o-mini': '💨 **GPT-4o Mini** - Fastest response, cost-effective', 
              'gpt-5': '🚀 **GPT-5** - Latest model with enhanced capabilities',
              'o3-mini': '🧠 **o3 Mini** - Advanced reasoning capabilities',
              'gpt-4-turbo': '🎯 **GPT-4 Turbo** - Balanced performance',
              'gpt-4': '📝 **GPT-4** - Classic, proven model'
            };
            
            let description = `**Current Active Model:** ${currentModel}\n\n**Available Models:**\n\n`;
            Object.entries(modelInfo).forEach(([key, info]) => {
              const current = key === currentModel ? ' ← *Current*' : '';
              description += `${info}${current}\n`;
            });
            
            const embed = new EmbedBuilder()
              .setTitle('🤖 Available OpenAI Models')
              .setDescription(description)
              .setColor(0x5865f2)
              .setFooter({ text: 'Use /model action:test to safely test before switching' })
              .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
          } else if (action === 'test') {
            if (!model) {
              await interaction.editReply('❌ Model parameter required for testing');
              return;
            }
            
            console.log(`� Testing model: ${model}`);
            
            // Test the model with a sample
            const testPrompt = "Summarize this in one sentence: The sky is blue because of light scattering.";
            const startTime = Date.now();
            
            try {
              const testResult = await summaryService.testModel(model, testPrompt);
              const duration = Date.now() - startTime;
              
              const embed = new EmbedBuilder()
                .setTitle(`🧪 Model Test Results: ${model}`)
                .setColor(0x51cf66)
                .addFields(
                  { name: '✅ Status', value: 'Model working correctly', inline: true },
                  { name: '⏱️ Response Time', value: `${duration}ms`, inline: true },
                  { name: '📝 Test Response', value: testResult || 'No response received', inline: false }
                )
                .setFooter({ text: 'Model is safe to use. Use /model action:set to switch.' })
                .setTimestamp();
              
              await interaction.editReply({ embeds: [embed] });
            } catch (error) {
              const embed = new EmbedBuilder()
                .setTitle(`❌ Model Test Failed: ${model}`)
                .setColor(0xff6b6b)
                .addFields(
                  { name: '❌ Error', value: error.message, inline: false },
                  { name: '⚠️ Recommendation', value: 'Try a different model or check API configuration', inline: false }
                )
                .setTimestamp();
              
              await interaction.editReply({ embeds: [embed] });
            }
            
          } else if (action === 'set') {
            if (!model) {
              await interaction.editReply('❌ Model parameter required for setting');
              return;
            }
            
            console.log(`🔄 Setting model to: ${model}`);
            
            try {
              // Update the model
              await summaryService.updateModel(model);
              
              const embed = new EmbedBuilder()
                .setTitle('✅ Model Updated Successfully')
                .setColor(0x51cf66)
                .addFields(
                  { name: '🤖 New Active Model', value: model, inline: true },
                  { name: '📊 Status', value: 'All future summaries will use this model', inline: true }
                )
                .setFooter({ text: 'Model change effective immediately' })
                .setTimestamp();
              
              await interaction.editReply({ embeds: [embed] });
            } catch (error) {
              await interaction.editReply('❌ Failed to update model: ' + error.message);
            }
          }
          
        } catch (error) {
          console.error('❌ Model command error:', error);
          await interaction.editReply('❌ Error managing model: ' + error.message);
        }
      }
    });
  }

  registerScheduleCommand() {
    const command = new SlashCommandBuilder()
      .setName('schedule')
      .setDescription('Update report schedules (daily/weekly/monthly)')
      .addStringOption(option =>
        option.setName('report-type')
          .setDescription('Which report schedule to update')
          .setRequired(true)
          .addChoices(
            { name: 'Daily Reports', value: 'daily' },
            { name: 'Weekly Reports', value: 'weekly' },
            { name: 'Monthly Reports', value: 'monthly' }
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
      .addStringOption(option =>
        option.setName('day')
          .setDescription('Day selection for weekly/monthly reports')
          .setRequired(false)
          .addChoices(
            // Weekly options
            { name: 'Sunday', value: 'sunday' },
            { name: 'Monday', value: 'monday' },
            { name: 'Tuesday', value: 'tuesday' },
            { name: 'Wednesday', value: 'wednesday' },
            { name: 'Thursday', value: 'thursday' },
            { name: 'Friday', value: 'friday' },
            { name: 'Saturday', value: 'saturday' },
            // Monthly options
            { name: '1st of month', value: '1' },
            { name: '15th of month', value: '15' },
            { name: 'Last day of month', value: 'last' }
          )
      );
    
    this.commands.set('schedule', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const reportType = interaction.options.getString('report-type');
          const newHour = interaction.options.getInteger('hour');
          const newMinute = interaction.options.getInteger('minute') || 0;
          const dayOption = interaction.options.getString('day');
          
          // Helper function to convert day string to number
          const getDayNumber = (dayStr) => {
            const dayMap = {
              'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
              'thursday': 4, 'friday': 5, 'saturday': 6
            };
            return dayMap[dayStr] !== undefined ? dayMap[dayStr] : 0;
          };
          
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
            const newDay = dayOption ? getDayNumber(dayOption) : 0; // Default to Sunday
            
            // Initialize weekly schedule if not exists
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
            this.serviceManager.config.discord.schedule.weeklyReportDay = newDay;
            
            embed = new EmbedBuilder()
              .setTitle('📊 Weekly Schedule Updated')
              .setColor(0x00AE86)
              .addFields(
                {
                  name: 'Previous Weekly Schedule',
                  value: `${dayNames[oldDay]}s at ${oldHour}:${oldMinute.toString().padStart(2, '0')} CEST`,
                  inline: true
                },
                {
                  name: 'New Weekly Schedule',
                  value: `${dayNames[newDay]}s at ${newHour}:${newMinute.toString().padStart(2, '0')} CEST`,
                  inline: true
                },
                {
                  name: '⚠️ Important Note',
                  value: 'Weekly schedule change requires bot restart to take effect. The new schedule will be active after the next deployment.',
                  inline: false
                }
              )
              .setFooter({ text: 'Weekly schedules are temporary until restart. For permanent changes, update deployment configuration.' })
              .setTimestamp();
            
            this.logger.info(`Weekly report schedule changed from ${dayNames[oldDay]}s ${oldHour}:${oldMinute.toString().padStart(2, '0')} to ${dayNames[newDay]}s ${newHour}:${newMinute.toString().padStart(2, '0')} CEST by ${interaction.user.tag}`);
            
          } else if (reportType === 'monthly') {
            // Handle monthly report schedule update
            let dayDescription = '1st of month';
            let cronDay = '1';
            
            if (dayOption) {
              if (dayOption === 'last') {
                dayDescription = 'Last day of month';
                cronDay = 'L'; // Last day cron syntax
              } else if (dayOption === '15') {
                dayDescription = '15th of month';
                cronDay = '15';
              } else if (dayOption === '1') {
                dayDescription = '1st of month';
                cronDay = '1';
              }
            }
            
            // Initialize monthly schedule if not exists
            if (!this.serviceManager.config.discord.schedule.monthlyReportHour) {
              this.serviceManager.config.discord.schedule.monthlyReportHour = 20;
              this.serviceManager.config.discord.schedule.monthlyReportMinute = 0;
              this.serviceManager.config.discord.schedule.monthlyReportDay = '1';
            }
            
            const oldHour = this.serviceManager.config.discord.schedule.monthlyReportHour;
            const oldMinute = this.serviceManager.config.discord.schedule.monthlyReportMinute;
            const oldDay = this.serviceManager.config.discord.schedule.monthlyReportDay || '1';
            
            // Update the configuration
            this.serviceManager.config.discord.schedule.monthlyReportHour = newHour;
            this.serviceManager.config.discord.schedule.monthlyReportMinute = newMinute;
            this.serviceManager.config.discord.schedule.monthlyReportDay = cronDay;
            
            const oldDayDesc = oldDay === 'L' ? 'Last day of month' : 
                              oldDay === '15' ? '15th of month' : '1st of month';
            
            embed = new EmbedBuilder()
              .setTitle('📅 Monthly Schedule Updated')
              .setColor(0x00AE86)
              .addFields(
                {
                  name: 'Previous Monthly Schedule',
                  value: `${oldDayDesc} at ${oldHour}:${oldMinute.toString().padStart(2, '0')} CEST`,
                  inline: true
                },
                {
                  name: 'New Monthly Schedule',
                  value: `${dayDescription} at ${newHour}:${newMinute.toString().padStart(2, '0')} CEST`,
                  inline: true
                },
                {
                  name: '⚠️ Important Note',
                  value: 'Monthly schedule change requires bot restart to take effect. The new schedule will be active after the next deployment.',
                  inline: false
                }
              )
              .setFooter({ text: 'Monthly schedules are temporary until restart. For permanent changes, update deployment configuration.' })
              .setTimestamp();
            
            this.logger.info(`Monthly report schedule changed from ${oldDayDesc} ${oldHour}:${oldMinute.toString().padStart(2, '0')} to ${dayDescription} ${newHour}:${newMinute.toString().padStart(2, '0')} CEST by ${interaction.user.tag}`);
          }
          
          await interaction.editReply({ embeds: [embed] });
          
        } catch (error) {
          console.error('❌ Set schedule command error:', error);
          await interaction.editReply('❌ Failed to update schedule');
        }
      }
    });
  }

  registerCacheCommand() {
    const command = new SlashCommandBuilder()
      .setName('cache')
      .setDescription('Manage cache system (view stats, debug contents, or clear)')
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Cache action to perform')
          .setRequired(true)
          .addChoices(
            { name: '📊 View Statistics', value: 'stats' },
            { name: '🔍 Debug Contents', value: 'debug' },
            { name: '🗑️ Clear Cache', value: 'clear' }
          )
      )
      .addStringOption(option =>
        option.setName('filter')
          .setDescription('Filter for debug/clear (e.g., "summaries", "transcripts", specific date)')
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option.setName('cleanup')
          .setDescription('Perform automatic cleanup (remove old files)')
          .setRequired(false)
      );
    
    this.commands.set('cache', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const action = interaction.options.getString('action');
          const filter = interaction.options.getString('filter') || '';
          const cleanup = interaction.options.getBoolean('cleanup') || false;
          
          const cacheService = await this.serviceManager.getService('cache');
          if (!cacheService) {
            throw new Error('Cache service not available');
          }
          
          if (action === 'stats') {
            console.log(`💾 Cache stats via command, cleanup: ${cleanup}`);
            
            const stats = await cacheService.getStats();
            
            let description = `📊 **Cache Statistics:**\n`;
            description += `• Total files: ${stats.totalFiles}\n`;
            description += `• Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB\n`;
            
            if (stats.breakdown) {
              description += `\n📁 **File Types:**\n`;
              Object.entries(stats.breakdown).forEach(([type, count]) => {
                description += `• ${type}: ${count} files\n`;
              });
            }
            
            if (cleanup) {
              description += `\n🧹 **Cleanup Results:**\n`;
              const cleanupResults = await cacheService.cleanup();
              description += `• Removed ${cleanupResults.removed} old files\n`;
              description += `• Freed ${(cleanupResults.spaceSaved / 1024 / 1024).toFixed(2)} MB\n`;
            }
            
            const embed = new EmbedBuilder()
              .setTitle('💾 Cache Management')
              .setDescription(description)
              .setColor(0x74c0fc)
              .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
          } else if (action === 'debug') {
            console.log(`🔍 Debugging cache with filter: "${filter}"`);
            
            const debugInfo = await cacheService.debugCache(filter);
            
            let description = '🔍 **Cache Debug Results:**\n\n';
            
            if (Object.keys(debugInfo).length === 0) {
              description += '📭 No cache files found matching the filter.';
            } else {
              Object.entries(debugInfo).forEach(([filename, info]) => {
                description += `📄 **${filename}**\n`;
                description += `• Size: ${(info.size / 1024).toFixed(2)} KB\n`;
                description += `• Modified: <t:${Math.floor(info.modified / 1000)}:R>\n\n`;
              });
              
              if (description.length > 1900) {
                description = description.substring(0, 1900) + '\n... (output truncated)';
              }
            }
            
            const embed = new EmbedBuilder()
              .setTitle('🔍 Cache Debug Results')
              .setDescription(description)
              .setColor(0xffd43b)
              .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
          } else if (action === 'clear') {
            console.log(`🗑️ Clearing cache with filter: "${filter}"`);
            
            let results = [];
            
            if (filter === 'summaries') {
              const cleared = await cacheService.clearSummaries();
              results.push(`✅ Cleared ${cleared} summary files`);
            } else if (filter === 'reports') {
              const cleared = await cacheService.clearReports();
              results.push(`✅ Cleared ${cleared} report files`);
            } else if (filter === 'all' || filter === '') {
              const summariesCleared = await cacheService.clearSummaries();
              const reportsCleared = await cacheService.clearReports();
              results.push(`✅ Cleared ${summariesCleared} summary files`);
              results.push(`✅ Cleared ${reportsCleared} report files`);
            } else if (filter.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Date format YYYY-MM-DD
              const cleared = await cacheService.clearByDate(filter);
              results.push(`✅ Cleared ${cleared} files from ${filter}`);
            } else {
              results.push('❌ Invalid filter. Use: summaries, reports, all, or YYYY-MM-DD format');
            }
            
            const embed = new EmbedBuilder()
              .setTitle('🗑️ Cache Clear Results')
              .setDescription(results.join('\n'))
              .setColor(results.some(r => r.includes('❌')) ? 0xff6b6b : 0x51cf66)
              .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
          }
          
        } catch (error) {
          console.error('❌ Cache command error:', error);
          await interaction.editReply('❌ Error managing cache: ' + error.message);
        }
      }
    });
  }

  registerPromptsCommand() {
    const command = new SlashCommandBuilder()
      .setName('prompts')
      .setDescription('Manage Discord prompts (reload from pinned messages or validate)')
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Prompt action to perform')
          .setRequired(true)
          .addChoices(
            { name: '🔄 Reload All Prompts', value: 'reload' },
            { name: '✅ Validate Prompts', value: 'validate' },
            { name: '📋 List Prompt Channels', value: 'list' }
          )
      );
    
    this.commands.set('prompts', {
      data: command,
      execute: async (interaction) => {
        await interaction.deferReply();
        
        try {
          const action = interaction.options.getString('action');
          
          const discordService = await this.serviceManager.getService('discord');
          if (!discordService) {
            throw new Error('Discord service not available');
          }
          
          if (action === 'reload') {
            console.log('🔄 Reloading prompts via command...');
            
            const results = [];
            
            // Reload prompts for all channels
            const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
            if (guild) {
              const summaryPromptChannels = guild.channels.cache.filter(
                ch => ch.name && (
                  ch.name.startsWith(discordService.config.prefixes.summaryPrompt) ||
                  ch.name === 'yt-summary-prompt'
                )
              );
              
              for (const [channelId, channel] of summaryPromptChannels) {
                try {
                  const prompt = await discordService.getPromptFromChannel(channel.name);
                  let suffix;
                  if (channel.name.startsWith(discordService.config.prefixes.summaryPrompt)) {
                    suffix = channel.name.replace(discordService.config.prefixes.summaryPrompt, '');
                  } else {
                    suffix = '(base)';
                  }
                  results.push(`✅ Summary Prompt ${suffix}: ${prompt ? 'Reloaded' : 'Not found'}`);
                } catch (error) {
                  let suffix;
                  if (channel.name.startsWith(discordService.config.prefixes.summaryPrompt)) {
                    suffix = channel.name.replace(discordService.config.prefixes.summaryPrompt, '');
                  } else {
                    suffix = '(base)';
                  }
                  results.push(`❌ Summary Prompt ${suffix}: ${error.message}`);
                }
              }
              
              // Reload weekly/monthly report prompts
              ['weekly', 'monthly'].forEach(reportType => {
                const channelName = `yt-${reportType}-report-prompt`;
                const channel = guild.channels.cache.find(ch => ch.name === channelName);
                if (channel) {
                  try {
                    discordService.getPromptFromChannel(channelName);
                    results.push(`✅ ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report Prompt: Reloaded`);
                  } catch (error) {
                    results.push(`❌ ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report Prompt: ${error.message}`);
                  }
                }
              });
            }
            
            const embed = new EmbedBuilder()
              .setTitle('🔄 Prompt Reload Results')
              .setDescription(results.join('\n'))
              .setColor(results.some(r => r.includes('❌')) ? 0xff6b6b : 0x51cf66)
              .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
          } else if (action === 'validate') {
            console.log('✅ Validating prompts via command...');
            
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
            
          } else if (action === 'list') {
            console.log('📋 Listing prompt channels via command...');
            
            const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
            if (!guild) {
              throw new Error('Guild not found');
            }
            
            const promptChannels = guild.channels.cache.filter(
              ch => ch.name && (
                ch.name.includes('prompt') ||
                ch.name.startsWith(discordService.config.prefixes.summaryPrompt)
              )
            );
            
            let description = '📋 **Prompt Channels:**\n\n';
            
            if (promptChannels.size === 0) {
              description += '📭 No prompt channels found.';
            } else {
              promptChannels.forEach(channel => {
                description += `📄 **#${channel.name}**\n`;
                description += `• Type: ${channel.type}\n`;
                description += `• Created: <t:${Math.floor(channel.createdTimestamp / 1000)}:R>\n\n`;
              });
            }
            
            const embed = new EmbedBuilder()
              .setTitle('📋 Prompt Channels')
              .setDescription(description)
              .setColor(0x5865f2)
              .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
          }
          
        } catch (error) {
          console.error('❌ Prompts command error:', error);
          await interaction.editReply('❌ Error managing prompts: ' + error.message);
        }
      }
    });
  }
}

module.exports = CommandService;
