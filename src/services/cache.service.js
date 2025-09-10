/**
 * Cache Service - Manage file-based caching
 */

const fs = require('fs').promises;
const path = require('path');

class CacheService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.logger = dependencies.logger || console;
    this.cacheDir = path.join(process.cwd(), 'cache');
  }

  async initialize() {
    // Ensure cache directory exists
    try {
      await fs.access(this.cacheDir);
    } catch (error) {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
    console.log('💾 Cache service initialized');
  }

  async get(key) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }

  async set(key, value) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(value, null, 2));
      return true;
    } catch (error) {
      console.error(`Error setting cache ${key}:`, error);
      return false;
    }
  }

  async delete(key) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      // File doesn't exist
      return false;
    }
  }

  async getStats() {
    try {
      const files = await fs.readdir(this.cacheDir);
      
      let totalSize = 0;
      let transcripts = 0;
      let summaries = 0;
      let reports = 0;
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        if (file.includes('transcript')) transcripts++;
        else if (file.includes('summary')) summaries++;
        else if (file.includes('report')) reports++;
      }
      
      return {
        totalFiles: files.length,
        totalSize: this.formatBytes(totalSize),
        transcripts,
        summaries,
        reports
      };
      
    } catch (error) {
      console.error('Error getting cache stats:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      let removed = 0;
      let spaceSaved = 0;
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          spaceSaved += stats.size;
          await fs.unlink(filePath);
          removed++;
        }
      }
      
      return {
        removed,
        spaceSaved: this.formatBytes(spaceSaved)
      };
      
    } catch (error) {
      console.error('Error cleaning cache:', error);
      throw error;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async healthCheck() {
    try {
      const stats = await this.getStats();
      return {
        status: 'ok',
        details: `${stats.totalFiles} files, ${stats.totalSize}`
      };
    } catch (error) {
      return {
        status: 'error',
        details: error.message
      };
    }
  }
}

module.exports = CacheService;
