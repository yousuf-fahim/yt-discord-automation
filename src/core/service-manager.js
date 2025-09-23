/**
 * Service Manager - Centralized service coordination
 * This acts as a bridge during the refactoring process
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class ServiceManager extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.config = this.loadConfig();
    this.logger = this.createLogger();
    this.isInitialized = false;
  }

  /**
   * Load configuration based on environment
   */
  loadConfig() {
    const env = process.env.NODE_ENV || 'development';
    const defaultConfig = {
      discord: {
        token: process.env.DISCORD_BOT_TOKEN,
        guildId: process.env.DISCORD_GUILD_ID,
        channels: {
          uploads: process.env.DISCORD_YT_SUMMARIES_CHANNEL || 'yt-uploads',
          transcripts: process.env.DISCORD_YT_TRANSCRIPTS_CHANNEL || 'yt-transcripts', 
          dailyReport: process.env.DISCORD_DAILY_REPORT_CHANNEL || 'daily-report'
        },
        // Allowed channel patterns for YouTube link processing
        allowedChannelPatterns: process.env.DISCORD_ALLOWED_CHANNELS ? 
          process.env.DISCORD_ALLOWED_CHANNELS.split(',').map(s => s.trim()) : 
          ['youtube', 'videos', 'media', 'links', 'general', 'bot-spam', 'feeds', 'notifications'],
        // Trusted bots that can trigger video processing
        trustedBots: process.env.DISCORD_TRUSTED_BOTS ? 
          process.env.DISCORD_TRUSTED_BOTS.split(',').map(s => s.trim()) : 
          ['NotifyMe', 'IFTTT', 'Zapier', 'YouTube', 'RSS'],
        prefixes: {
          summaryPrompt: process.env.SUMMARY_PROMPT_PREFIX || 'yt-summary-prompt-',
          summariesOutput: process.env.SUMMARIES_OUTPUT_PREFIX || 'yt-summaries-',
          dailyReportPrompt: process.env.DAILY_REPORT_PROMPT_PREFIX || 'yt-daily-report-prompt-'
        },
        schedule: {
          dailyReportHour: parseInt(process.env.DAILY_REPORT_HOUR) || 18,
          dailyReportMinute: parseInt(process.env.DAILY_REPORT_MINUTE) || 0
        }
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000
      },
      youtube: {
        apiKey: process.env.YOUTUBE_API_KEY
      },
      cache: {
        ttl: parseInt(process.env.CACHE_TTL) || 3600,
        maxSizeMB: parseInt(process.env.MAX_CACHE_SIZE_MB) || 100,
        directory: path.join(process.cwd(), 'cache')
      },
      app: {
        debug: process.env.DEBUG_MODE === 'true',
        timezone: process.env.TIMEZONE || 'Europe/Berlin',
        port: parseInt(process.env.PORT) || 3000
      }
    };

    return defaultConfig;
  }

  /**
   * Create centralized logger
   */
  createLogger() {
    return {
      info: (message, meta = {}) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`, meta);
      },
      error: (message, error = null, meta = {}) => {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`, error?.message || error, meta);
        if (error?.stack && this.config.app.debug) {
          console.error(error.stack);
        }
      },
      debug: (message, meta = {}) => {
        if (this.config.app.debug) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] DEBUG: ${message}`, meta);
        }
      },
      warn: (message, meta = {}) => {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] WARN: ${message}`, meta);
      }
    };
  }

  /**
   * Register a service
   */
  registerService(name, serviceClass, dependencies = []) {
    this.logger.debug(`Registering service: ${name}`, { dependencies });
    
    this.services.set(name, {
      class: serviceClass,
      instance: null,
      dependencies,
      initialized: false
    });
  }

  /**
   * Get a service instance
   */
  getService(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }

    if (!service.initialized) {
      this.initializeService(name);
    }

    return service.instance;
  }

  /**
   * Initialize a specific service
   */
  initializeService(name) {
    const service = this.services.get(name);
    if (!service || service.initialized) return;

    this.logger.debug(`Initializing service: ${name}`);

    // Initialize dependencies first
    const dependencies = {};
    for (const depName of service.dependencies) {
      dependencies[depName] = this.getService(depName);
    }

    // Create service instance
    service.instance = new service.class(this, dependencies);
    service.initialized = true;

    this.logger.info(`Service initialized: ${name}`);
    this.emit('serviceInitialized', name, service.instance);
  }

  /**
   * Initialize all services
   */
  async initializeAll() {
    if (this.isInitialized) return;

    this.logger.info('Initializing ServiceManager...');

    // Validate required configuration
    this.validateConfig();

    // Initialize services in dependency order
    const serviceNames = Array.from(this.services.keys());
    const sortedServices = this.topologicalSort(serviceNames);

    for (const serviceName of sortedServices) {
      this.initializeService(serviceName);
    }

    this.isInitialized = true;
    this.logger.info('ServiceManager initialized successfully');
    this.emit('initialized');
  }

  /**
   * Validate required configuration
   */
  validateConfig() {
    const required = [
      ['discord.token', 'DISCORD_BOT_TOKEN'],
      ['openai.apiKey', 'OPENAI_API_KEY']
    ];

    for (const [configPath, envVar] of required) {
      const value = this.getConfigValue(configPath);
      if (!value) {
        throw new Error(`Missing required configuration: ${envVar}`);
      }
    }
  }

  /**
   * Get nested config value
   */
  getConfigValue(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  /**
   * Topological sort for dependency resolution
   */
  topologicalSort(serviceNames) {
    const visited = new Set();
    const result = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      visited.add(name);

      const service = this.services.get(name);
      if (service) {
        for (const dep of service.dependencies) {
          visit(dep);
        }
      }

      result.push(name);
    };

    for (const name of serviceNames) {
      visit(name);
    }

    return result;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down ServiceManager...');

    // Shutdown services in reverse order
    const serviceNames = Array.from(this.services.keys()).reverse();
    
    for (const name of serviceNames) {
      const service = this.services.get(name);
      if (service?.instance?.shutdown) {
        try {
          await service.instance.shutdown();
          this.logger.debug(`Service shutdown: ${name}`);
        } catch (error) {
          this.logger.error(`Error shutting down service ${name}`, error);
        }
      }
    }

    this.emit('shutdown');
    this.logger.info('ServiceManager shutdown complete');
  }

  /**
   * Health check for all services
   */
  async healthCheck() {
    const results = {};
    
    for (const [name, service] of this.services) {
      if (service.instance?.healthCheck) {
        try {
          results[name] = await service.instance.healthCheck();
        } catch (error) {
          results[name] = { status: 'error', error: error.message };
        }
      } else {
        results[name] = { status: 'ok', message: 'No health check implemented' };
      }
    }

    return results;
  }
}

// Global service manager instance
const serviceManager = new ServiceManager();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  await serviceManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  await serviceManager.shutdown();
  process.exit(0);
});

module.exports = ServiceManager;
module.exports.serviceManager = serviceManager;
