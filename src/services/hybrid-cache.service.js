/**
 * Hybrid Cache Service - Optimized cache-database integration
 * 
 * STRATEGY:
 * - Hot data (recent summaries): Cache for instant access
 * - Warm data (last 7 days): Database with cache backup
 * - Cold data (older): Database only
 * - Reports: Database primary, cache for current period
 */

const fs = require('fs').promises;
const path = require('path');

class HybridCacheService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.database = dependencies.database;
    this.logger = serviceManager.logger;
    this.cacheDir = path.join(process.cwd(), 'cache');
    
    // Cache strategy configuration
    this.config = {
      // How long to keep items in memory cache (minutes)
      memoryTTL: 30,
      // How long to keep items in file cache (hours) 
      fileCacheTTL: 24,
      // How many recent summaries to keep in hot cache
      hotCacheSize: 50,
      // Cache prefixes for different data types
      prefixes: {
        summary: 'summary_',
        transcript: 'transcript_',
        report: 'report_',
        metadata: 'metadata_'
      }
    };
    
    // In-memory cache for hot data
    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0
    };
  }

  async initialize() {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Clean up old cache files on startup
      await this.cleanupOldCache();
      
      // Load recent data into memory cache
      await this.preloadHotData();
      
      this.logger.info('🔥 Hybrid cache service initialized with database integration');
    } catch (error) {
      this.logger.error('Failed to initialize hybrid cache service:', error);
      throw error;
    }
  }

  /**
   * Get data with intelligent cache hierarchy
   * 1. Memory cache (fastest)
   * 2. File cache (fast)
   * 3. Database (reliable)
   */
  async get(key, options = {}) {
    const { type = 'summary', bypassCache = false } = options;
    
    try {
      // 1. Check memory cache first (if not bypassing)
      if (!bypassCache && this.memoryCache.has(key)) {
        this.cacheStats.hits++;
        const data = this.memoryCache.get(key);
        if (this.isValidCacheEntry(data)) {
          return data.value;
        } else {
          this.memoryCache.delete(key);
        }
      }

      // 2. Check file cache
      if (!bypassCache) {
        const fileData = await this.getFromFileCache(key);
        if (fileData) {
          this.cacheStats.hits++;
          // Promote to memory cache if recent
          this.setMemoryCache(key, fileData);
          return fileData;
        }
      }

      // 3. Check database as final source
      this.cacheStats.misses++;
      const dbData = await this.getFromDatabase(key, type);
      
      if (dbData) {
        // Cache the database result for future access
        await this.setFileCache(key, dbData);
        this.setMemoryCache(key, dbData);
        return dbData;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting cached data for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set data in all cache layers and database
   */
  async set(key, value, options = {}) {
    const { type = 'summary', skipDatabase = false } = options;
    
    try {
      this.cacheStats.writes++;

      // 1. Set in memory cache (immediate access)
      this.setMemoryCache(key, value);

      // 2. Set in file cache (persistence)
      await this.setFileCache(key, value);

      // 3. Set in database (unless skipped)
      if (!skipDatabase) {
        await this.setInDatabase(key, value, type);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error setting cached data for ${key}:`, error);
      return false;
    }
  }

  /**
   * Specialized methods for different data types
   */
  async getSummary(videoId) {
    return await this.get(`summary_${videoId}`, { type: 'summary' });
  }

  async setSummary(videoId, summaryData) {
    return await this.set(`summary_${videoId}`, summaryData, { type: 'summary' });
  }

  async getTranscript(videoId) {
    return await this.get(`${videoId}_transcript`, { type: 'transcript' });
  }

  async setTranscript(videoId, transcriptData) {
    return await this.set(`${videoId}_transcript`, transcriptData, { type: 'transcript' });
  }

  async getReport(reportKey, reportType = 'daily') {
    return await this.get(`${reportType}_report_${reportKey}`, { type: 'report' });
  }

  async setReport(reportKey, reportData, reportType = 'daily') {
    return await this.set(`${reportType}_report_${reportKey}`, reportData, { 
      type: 'report',
      reportType 
    });
  }

  /**
   * Get recent summaries efficiently
   */
  async getRecentSummaries(hours = 24) {
    try {
      // Try to get from database with cache backup
      const dbSummaries = await this.database.getRecentSummaries(hours);
      
      if (dbSummaries && dbSummaries.length > 0) {
        // Cache recent summaries for faster access
        for (const summary of dbSummaries.slice(0, 10)) {
          this.setMemoryCache(`summary_${summary.video_id}`, summary);
        }
        return dbSummaries;
      }

      // Fallback to file cache scan (slower but reliable)
      return await this.scanFileCacheForRecent(hours);
    } catch (error) {
      this.logger.error('Error getting recent summaries:', error);
      return [];
    }
  }

  /**
   * Memory cache operations
   */
  setMemoryCache(key, value) {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.config.hotCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
      this.cacheStats.evictions++;
    }

    this.memoryCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: this.config.memoryTTL * 60 * 1000 // Convert to milliseconds
    });
  }

  isValidCacheEntry(entry) {
    return entry && (Date.now() - entry.timestamp) < entry.ttl;
  }

  /**
   * File cache operations
   */
  async getFromFileCache(key) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const stats = await fs.stat(filePath);
      
      // Check if file is within TTL
      const age = Date.now() - stats.mtime.getTime();
      if (age > this.config.fileCacheTTL * 60 * 60 * 1000) {
        return null; // File too old
      }

      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async setFileCache(key, value) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(value, null, 2));
      return true;
    } catch (error) {
      this.logger.error(`Error writing file cache ${key}:`, error);
      return false;
    }
  }

  /**
   * Database integration methods
   */
  async getFromDatabase(key, type) {
    if (!this.database) return null;

    try {
      if (type === 'summary') {
        const videoId = key.replace('summary_', '');
        return await this.database.getSummary(videoId);
      } else if (type === 'transcript') {
        const videoId = key.replace('_transcript', '');
        return await this.database.getTranscript(videoId);
      } else if (type === 'report') {
        // Handle different report types
        if (key.includes('daily_report_')) {
          const date = key.replace('daily_report_', '');
          return await this.database.getDailyReport(date);
        } else if (key.includes('weekly_report_')) {
          const weekStart = key.replace('weekly_report_', '');
          return await this.database.getWeeklyReport(weekStart);
        } else if (key.includes('monthly_report_')) {
          const [year, month] = key.replace('monthly_report_', '').split('-');
          return await this.database.getMonthlyReport(parseInt(year), parseInt(month));
        }
      }
      return null;
    } catch (error) {
      this.logger.error(`Error getting from database ${key}:`, error);
      return null;
    }
  }

  async setInDatabase(key, value, type) {
    if (!this.database) return false;

    try {
      if (type === 'summary') {
        const videoId = key.replace('summary_', '');
        return await this.database.saveSummary({
          videoId,
          ...value
        });
      } else if (type === 'transcript') {
        const videoId = key.replace('_transcript', '');
        return await this.database.saveTranscript(videoId, value);
      } else if (type === 'report') {
        // Handle different report types
        if (key.includes('daily_report_')) {
          return await this.database.saveDailyReport(value);
        } else if (key.includes('weekly_report_')) {
          return await this.database.saveWeeklyReport(value);
        } else if (key.includes('monthly_report_')) {
          return await this.database.saveMonthlyReport(value);
        }
      }
      return false;
    } catch (error) {
      this.logger.error(`Error saving to database ${key}:`, error);
      return false;
    }
  }

  /**
   * Maintenance operations
   */
  async cleanupOldCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtime.getTime();

        // Remove files older than 7 days
        if (age > 7 * 24 * 60 * 60 * 1000) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.info(`Cleaned up ${cleaned} old cache files`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up cache:', error);
    }
  }

  async preloadHotData() {
    try {
      // Load recent summaries into memory cache
      const recent = await this.database?.getRecentSummaries(6); // Last 6 hours
      if (recent) {
        for (const summary of recent.slice(0, 20)) {
          this.setMemoryCache(`summary_${summary.video_id}`, summary);
        }
        this.logger.info(`Preloaded ${recent.length} recent summaries into hot cache`);
      }
    } catch (error) {
      this.logger.error('Error preloading hot data:', error);
    }
  }

  async scanFileCacheForRecent(hours) {
    try {
      const files = await fs.readdir(this.cacheDir);
      const summaries = [];
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);

      for (const file of files) {
        if (!file.includes('summary_') || !file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() > cutoff) {
          try {
            const data = await fs.readFile(filePath, 'utf8');
            summaries.push(JSON.parse(data));
          } catch (e) {
            // Skip corrupted files
          }
        }
      }

      return summaries.sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at));
    } catch (error) {
      this.logger.error('Error scanning file cache:', error);
      return [];
    }
  }

  /**
   * Cache analytics and health
   */
  getStats() {
    return {
      ...this.cacheStats,
      memorySize: this.memoryCache.size,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }

  /**
   * Get today's summaries (compatibility method)
   */
  async getTodaysSummaries() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const summaries = await this.getRecentSummaries(24);
      
      // Filter to today only
      return summaries.filter(summary => {
        if (!summary.timestamp && !summary.created_at) return false;
        const summaryDate = new Date(summary.timestamp || summary.created_at).toISOString().split('T')[0];
        return summaryDate === today;
      });
    } catch (error) {
      this.logger.error('Error getting today\'s summaries:', error);
      return [];
    }
  }

  /**
   * Debug cache contents (compatibility method)
   */
  async debugCache(pattern = null) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const debug = {
        memoryCache: {
          size: this.memoryCache.size,
          keys: Array.from(this.memoryCache.keys()),
          maxSize: this.config.hotCacheSize
        },
        fileCache: {
          directory: this.cacheDir,
          files: []
        },
        database: {
          connected: !!this.database,
          status: this.database ? 'available' : 'not available'
        },
        stats: this.getStats()
      };

      // Get file cache contents
      try {
        const files = await fs.readdir(this.cacheDir);
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          if (pattern && !file.includes(pattern)) continue;
          
          try {
            const filePath = path.join(this.cacheDir, file);
            const stats = await fs.stat(filePath);
            const data = await fs.readFile(filePath, 'utf8');
            const content = JSON.parse(data);
            
            debug.fileCache.files.push({
              name: file,
              size: stats.size,
              modified: stats.mtime,
              preview: typeof content === 'object' ? 
                Object.keys(content).slice(0, 5) : 
                String(content).substring(0, 100)
            });
          } catch (e) {
            debug.fileCache.files.push({
              name: file,
              error: 'Failed to read: ' + e.message
            });
          }
        }
      } catch (e) {
        debug.fileCache.error = e.message;
      }

      return debug;
    } catch (error) {
      this.logger.error('Error debugging cache:', error);
      return { error: error.message };
    }
  }

  async healthCheck() {
    const stats = this.getStats();
    const health = {
      status: 'ok',
      memoryCache: {
        size: stats.memorySize,
        maxSize: this.config.hotCacheSize
      },
      performance: {
        hitRate: Math.round(stats.hitRate * 100) + '%',
        totalRequests: stats.hits + stats.misses
      },
      database: this.database ? 'connected' : 'not available'
    };

    if (stats.hitRate < 0.3) {
      health.status = 'warning';
      health.warning = 'Low cache hit rate - consider tuning cache strategy';
    }

    return health;
  }

  /**
   * Get today's summaries for command service compatibility
   */
  async getTodaysSummaries() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayData = await this.get(`summaries_${today}`, { type: 'summary' });
      
      if (todayData && Array.isArray(todayData)) {
        return todayData;
      }
      
      // Fallback to scanning cache files
      const recent = await this.getRecentSummaries(24);
      const today_start = new Date();
      today_start.setHours(0, 0, 0, 0);
      
      return recent.filter(summary => {
        const summaryDate = new Date(summary.timestamp || summary.created_at);
        return summaryDate >= today_start;
      });
    } catch (error) {
      this.logger.error('Error getting today\'s summaries:', error);
      return [];
    }
  }

  /**
   * List all summaries grouped by date
   */
  async listSummaries() {
    try {
      const summariesByDate = {};
      
      // Check database for summaries
      if (this.databaseService) {
        try {
          const dbSummaries = await this.databaseService.getAllSummaries();
          dbSummaries.forEach(summary => {
            const date = new Date(summary.created_at).toISOString().split('T')[0];
            if (!summariesByDate[date]) summariesByDate[date] = [];
            summariesByDate[date].push(summary);
          });
        } catch (error) {
          this.logger.warn('Could not fetch summaries from database:', error.message);
        }
      }

      // Also scan file cache for additional summaries
      const files = await this.scanFileCacheForRecent(24 * 30); // Last 30 days
      files.forEach(summary => {
        const date = new Date(summary.timestamp || summary.created_at).toISOString().split('T')[0];
        if (!summariesByDate[date]) summariesByDate[date] = [];
        // Avoid duplicates from database
        const exists = summariesByDate[date].some(s => s.videoId === summary.videoId);
        if (!exists) {
          summariesByDate[date].push(summary);
        }
      });

      return summariesByDate;
    } catch (error) {
      this.logger.error('Error listing summaries:', error);
      return {};
    }
  }

  /**
   * Debug cache contents for command service compatibility
   */
  async debugCache(pattern = '') {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const files = await fs.readdir(this.cacheDir);
      const results = [];
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        if (pattern && !file.includes(pattern)) continue;
        
        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          const data = await fs.readFile(filePath, 'utf8');
          const content = JSON.parse(data);
          
          results.push({
            file,
            size: stats.size,
            modified: stats.mtime,
            contentType: typeof content,
            hasData: !!content,
            preview: typeof content === 'string' ? 
              content.substring(0, 100) + '...' : 
              JSON.stringify(content).substring(0, 100) + '...'
          });
        } catch (e) {
          results.push({
            file,
            error: e.message
          });
        }
      }
      
      return {
        pattern: pattern || 'all',
        totalFiles: files.length,
        matchingFiles: results.length,
        memoryCache: {
          size: this.memoryCache.size,
          keys: Array.from(this.memoryCache.keys()).slice(0, 10)
        },
        files: results.slice(0, 20) // Limit results
      };
    } catch (error) {
      this.logger.error('Error debugging cache:', error);
      return {
        error: error.message
      };
    }
  }

  /**
   * Get today's summaries (compatibility method)
   */
  async getTodaysSummaries() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const summaries = [];
      
      // Try to get from database first
      if (this.database) {
        const dbSummaries = await this.database.getAllQuery(`
          SELECT * FROM summaries 
          WHERE DATE(created_at) = ?
          ORDER BY created_at DESC
        `, [today]);
        
        if (dbSummaries && dbSummaries.length > 0) {
          return dbSummaries;
        }
      }

      // Fallback to cache scanning
      return await this.scanFileCacheForToday();
    } catch (error) {
      this.logger.error('Error getting today\'s summaries:', error);
      return [];
    }
  }

  /**
   * Debug cache contents (compatibility method)
   */
  async debugCache(pattern = null) {
    try {
      const debug = {
        memoryCache: {
          size: this.memoryCache.size,
          items: Array.from(this.memoryCache.keys()).filter(k => 
            !pattern || k.includes(pattern)
          )
        },
        fileCache: await this.debugFileCache(pattern),
        database: this.database ? 'available' : 'not available',
        stats: this.getStats()
      };

      return debug;
    } catch (error) {
      this.logger.error('Error debugging cache:', error);
      return { error: error.message };
    }
  }

  /**
   * Get cache statistics (enhanced version)
   */
  async getStats() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      let fileCount = 0;
      
      const categoryCounts = {
        summaries: 0,
        transcripts: 0,
        reports: 0,
        other: 0
      };

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileCount++;

          // Categorize files
          if (file.includes('summary_')) {
            categoryCounts.summaries++;
          } else if (file.includes('transcript')) {
            categoryCounts.transcripts++;
          } else if (file.includes('report_')) {
            categoryCounts.reports++;
          } else {
            categoryCounts.other++;
          }
        } catch (e) {
          // Skip files we can't read
        }
      }

      return {
        ...this.cacheStats,
        memorySize: this.memoryCache.size,
        hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
        totalFiles: fileCount,
        totalSize: this.formatBytes(totalSize),
        summaries: categoryCounts.summaries,
        transcripts: categoryCounts.transcripts,
        reports: categoryCounts.reports,
        other: categoryCounts.other
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return this.cacheStats;
    }
  }

  /**
   * Cleanup old cache files
   */
  async cleanup() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      let removed = 0;
      let spaceSaved = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          const age = now - stats.mtime.getTime();

          // Remove files older than configured TTL (default 7 days)
          const maxAge = 7 * 24 * 60 * 60 * 1000;
          if (age > maxAge) {
            spaceSaved += stats.size;
            await fs.unlink(filePath);
            removed++;
          }
        } catch (e) {
          // Skip files we can't process
        }
      }

      return {
        removed,
        spaceSaved: this.formatBytes(spaceSaved)
      };
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      return { removed: 0, spaceSaved: '0 B' };
    }
  }

  /**
   * Helper methods
   */
  async scanFileCacheForToday() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const summaries = [];
      const today = new Date().toISOString().split('T')[0];

      for (const file of files) {
        if (!file.includes('summary_') || !file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          const fileDate = stats.mtime.toISOString().split('T')[0];

          if (fileDate === today) {
            const data = await fs.readFile(filePath, 'utf8');
            summaries.push(JSON.parse(data));
          }
        } catch (e) {
          // Skip corrupted files
        }
      }

      return summaries;
    } catch (error) {
      this.logger.error('Error scanning cache for today:', error);
      return [];
    }
  }

  async debugFileCache(pattern) {
    try {
      const files = await fs.readdir(this.cacheDir);
      const matching = files.filter(f => 
        f.endsWith('.json') && (!pattern || f.includes(pattern))
      );

      const details = [];
      for (const file of matching.slice(0, 10)) { // Limit to 10 for readability
        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          details.push({
            file,
            size: this.formatBytes(stats.size),
            modified: stats.mtime.toISOString()
          });
        } catch (e) {
          details.push({ file, error: 'Cannot read' });
        }
      }

      return {
        totalMatching: matching.length,
        details
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = HybridCacheService;