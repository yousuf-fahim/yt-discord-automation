/**
 * Modern Discord Bot Entry Point
 * Uses ServiceManager for better organization and error handling
 */

require('dotenv').config();
const { serviceManager } = require('./core/service-manager');

// Import service classes (these would be refactored versions of existing code)
const DiscordService = require('./services/discord.service');
const TranscriptService = require('./services/transcript.service');
const SummaryService = require('./services/summary.service');
const ReportService = require('./services/report.service');
const CacheService = require('./services/cache.service');

async function main() {
  try {
    // Register services with their dependencies
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('transcript', TranscriptService, ['cache']);
    serviceManager.registerService('summary', SummaryService, ['cache']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache']);
    serviceManager.registerService('discord', DiscordService, ['transcript', 'summary', 'report']);

    // Initialize all services
    await serviceManager.initializeAll();

    // Start the bot
    const discordService = serviceManager.getService('discord');
    await discordService.start();

    serviceManager.logger.info('🤖 Bot started successfully!');
    serviceManager.logger.info('📊 Health check available at /health');

    // Setup health check endpoint (if running as web service)
    if (process.env.PORT) {
      setupHealthEndpoint();
    }

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

/**
 * Setup simple health check endpoint
 */
function setupHealthEndpoint() {
  const express = require('express');
  const app = express();
  const port = process.env.PORT || 3000;

  app.get('/health', async (req, res) => {
    try {
      const health = await serviceManager.healthCheck();
      const allHealthy = Object.values(health).every(h => h.status === 'ok');
      
      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: health
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/', (req, res) => {
    res.json({
      name: 'YouTube Discord Automation Bot',
      status: 'running',
      timestamp: new Date().toISOString()
    });
  });

  app.listen(port, () => {
    serviceManager.logger.info(`Health server running on port ${port}`);
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  main();
}

module.exports = { main, serviceManager };
