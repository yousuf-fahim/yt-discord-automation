/**
 * Cache Service - Centralized caching for transcripts and summaries
 */

const fs = require('fs').promises;
const path = require('path');

class CacheService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.logger = serviceManager.logger;
    this.config = serviceManager.config.cache;
    
    this.cacheDir = this.config.directory;
    this.ttl = this.config.ttl;
    this.maxSizeMB = this.config.maxSizeMB;
  }

  async initialize() {
    await this.ensureCacheDirectory();
    this.logger.info('Cache service initialized');
  }

  async ensureCacheDirectory() {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  async get(key) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const cached = JSON.parse(data);
      
      // Check TTL
      if (Date.now() - cached.timestamp > this.ttl * 1000) {
        await this.delete(key);
        return null;
      }
      
      return cached.data;
    } catch (error) {
      return null;
    }
  }

  async set(key, data) {
    try {
      const cached = {
        data,
        timestamp: Date.now()
      };
      
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(cached));
      return true;
    } catch (error) {
      this.logger.error('Cache set error', error);
      return false;
    }
  }

  async delete(key) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async healthCheck() {
    return {
      status: 'ok',
      directory: this.cacheDir,
      ttl: this.ttl,
      maxSizeMB: this.maxSizeMB
    };
  }
}

module.exports = CacheService;
