/**
 * Database Service - SQLite-based persistent storage
 * Handles video summaries, reports, and analytics with proper schema
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.logger = serviceManager.logger;
    this.config = serviceManager.config;
    
    // Database configuration
    this.dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'bot.db');
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Connect to SQLite database
      this.db = await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            this.logger.error('Database connection failed:', err);
            reject(err);
          } else {
            resolve(db);
          }
        });
      });

      // Enable foreign keys and WAL mode for better performance
      await this.runQuery('PRAGMA foreign_keys = ON');
      await this.runQuery('PRAGMA journal_mode = WAL');
      await this.runQuery('PRAGMA synchronous = NORMAL');

      // Create tables
      await this.createTables();

      this.isInitialized = true;
      this.logger.info(`Database initialized: ${this.dbPath}`);
      
    } catch (error) {
      this.logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create database tables with proper schema
   */
  async createTables() {
    const tables = [
      // Video summaries table
      `CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT,
        prompt_type TEXT DEFAULT 'default',
        word_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Video transcripts table - NEW!
      `CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL UNIQUE,
        transcript_text TEXT NOT NULL,
        word_count INTEGER,
        duration INTEGER,
        language TEXT DEFAULT 'en',
        source TEXT DEFAULT 'youtube-api',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Daily reports table
      `CREATE TABLE IF NOT EXISTS daily_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        summary_count INTEGER DEFAULT 0,
        word_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Video metadata table
      `CREATE TABLE IF NOT EXISTS video_metadata (
        video_id TEXT PRIMARY KEY,
        title TEXT,
        duration INTEGER,
        channel_name TEXT,
        channel_id TEXT,
        published_at DATETIME,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        transcript_length INTEGER,
        FOREIGN KEY (video_id) REFERENCES summaries(video_id)
      )`,

      // Analytics table for tracking bot performance
      `CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        videos_processed INTEGER DEFAULT 0,
        total_summaries INTEGER DEFAULT 0,
        avg_summary_length REAL DEFAULT 0,
        total_words INTEGER DEFAULT 0,
        processing_time_avg REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // System logs table for better debugging
      `CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        service TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const tableSQL of tables) {
      await this.runQuery(tableSQL);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON summaries(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_summaries_video_id ON summaries(video_id)',
      'CREATE INDEX IF NOT EXISTS idx_transcripts_video_id ON transcripts(video_id)',
      'CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date)',
      'CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level, created_at)'
    ];

    for (const indexSQL of indexes) {
      await this.runQuery(indexSQL);
    }

    this.logger.info('Database tables and indexes created successfully');
  }

  /**
   * Promisified database query execution
   */
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Promisified database select query
   */
  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Promisified database select all query
   */
  getAllQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Save a video summary to database
   */
  async saveSummary(summary) {
    try {
      const {
        videoId,
        videoTitle,
        summaryContent,
        videoUrl,
        promptType = 'default'
      } = summary;

      const wordCount = summaryContent.split(' ').length;

      await this.runQuery(`
        INSERT OR REPLACE INTO summaries 
        (video_id, title, content, url, prompt_type, word_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [videoId, videoTitle, summaryContent, videoUrl, promptType, wordCount]);

      this.logger.info(`Summary saved to database: ${videoId}`);
      return true;
    } catch (error) {
      this.logger.error('Error saving summary to database:', error);
      return false;
    }
  }

  /**
   * Save a video transcript to database
   */
  async saveTranscript(transcript) {
    try {
      const {
        videoId,
        transcript: transcriptText,
        duration,
        language = 'en',
        source = 'youtube-api'
      } = transcript;

      const wordCount = transcriptText.split(' ').length;

      await this.runQuery(`
        INSERT OR REPLACE INTO transcripts 
        (video_id, transcript_text, word_count, duration, language, source)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [videoId, transcriptText, wordCount, duration, language, source]);

      this.logger.info(`Transcript saved to database: ${videoId} (${wordCount} words)`);
      return true;
    } catch (error) {
      this.logger.error('Error saving transcript to database:', error);
      return false;
    }
  }

  /**
   * Get transcript by video ID
   */
  async getTranscript(videoId) {
    try {
      const row = await this.getQuery(`
        SELECT * FROM transcripts WHERE video_id = ?
      `, [videoId]);

      return row || null;
    } catch (error) {
      this.logger.error('Error getting transcript:', error);
      return null;
    }
  }

  /**
   * Search transcripts by content
   */
  async searchTranscripts(query, limit = 10) {
    try {
      const rows = await this.getAllQuery(`
        SELECT t.video_id, t.transcript_text, t.word_count, t.created_at,
               s.title, s.url
        FROM transcripts t
        LEFT JOIN summaries s ON t.video_id = s.video_id
        WHERE t.transcript_text LIKE ? 
        ORDER BY t.created_at DESC
        LIMIT ?
      `, [`%${query}%`, limit]);

      return rows;
    } catch (error) {
      this.logger.error('Error searching transcripts:', error);
      return [];
    }
  }

  /**
   * Get summaries by date range
   */
  async getSummariesByDateRange(startDate, endDate) {
    try {
      const rows = await this.getAllQuery(`
        SELECT * FROM summaries 
        WHERE DATE(created_at) BETWEEN ? AND ?
        ORDER BY created_at DESC
      `, [startDate, endDate]);

      return rows;
    } catch (error) {
      this.logger.error('Error getting summaries by date range:', error);
      return [];
    }
  }

  /**
   * Get recent summaries (last N hours)
   */
  async getRecentSummaries(hours = 24) {
    try {
      const rows = await this.getAllQuery(`
        SELECT * FROM summaries 
        WHERE created_at >= datetime('now', '-${hours} hours')
        ORDER BY created_at DESC
      `, []);

      return rows;
    } catch (error) {
      this.logger.error('Error getting recent summaries:', error);
      return [];
    }
  }

  /**
   * Save daily report to database
   */
  async saveDailyReport(report) {
    try {
      const {
        date,
        content,
        summaryCount = 0
      } = report;

      const wordCount = content.split(' ').length;

      await this.runQuery(`
        INSERT OR REPLACE INTO daily_reports 
        (date, content, summary_count, word_count)
        VALUES (?, ?, ?, ?)
      `, [date, content, summaryCount, wordCount]);

      this.logger.info(`Daily report saved to database: ${date}`);
      return true;
    } catch (error) {
      this.logger.error('Error saving daily report to database:', error);
      return false;
    }
  }

  /**
   * Get daily report by date
   */
  async getDailyReport(date) {
    try {
      const row = await this.getQuery(`
        SELECT * FROM daily_reports 
        WHERE date = ?
      `, [date]);

      return row;
    } catch (error) {
      this.logger.error('Error getting daily report:', error);
      return null;
    }
  }

  /**
   * Save video metadata
   */
  async saveVideoMetadata(metadata) {
    try {
      const {
        videoId,
        title,
        duration,
        channelName,
        channelId,
        publishedAt,
        transcriptLength
      } = metadata;

      await this.runQuery(`
        INSERT OR REPLACE INTO video_metadata 
        (video_id, title, duration, channel_name, channel_id, published_at, transcript_length)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [videoId, title, duration, channelName, channelId, publishedAt, transcriptLength]);

      return true;
    } catch (error) {
      this.logger.error('Error saving video metadata:', error);
      return false;
    }
  }

  /**
   * Record daily analytics
   */
  async recordDailyAnalytics(date, stats) {
    try {
      const {
        videosProcessed = 0,
        totalSummaries = 0,
        avgSummaryLength = 0,
        totalWords = 0,
        processingTimeAvg = 0
      } = stats;

      await this.runQuery(`
        INSERT OR REPLACE INTO analytics 
        (date, videos_processed, total_summaries, avg_summary_length, total_words, processing_time_avg)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [date, videosProcessed, totalSummaries, avgSummaryLength, totalWords, processingTimeAvg]);

      return true;
    } catch (error) {
      this.logger.error('Error recording analytics:', error);
      return false;
    }
  }

  /**
   * Get analytics for date range
   */
  async getAnalytics(startDate, endDate) {
    try {
      const rows = await this.getAllQuery(`
        SELECT * FROM analytics 
        WHERE date BETWEEN ? AND ?
        ORDER BY date DESC
      `, [startDate, endDate]);

      return rows;
    } catch (error) {
      this.logger.error('Error getting analytics:', error);
      return [];
    }
  }

  /**
   * Search summaries by content
   */
  async searchSummaries(query, limit = 10) {
    try {
      const rows = await this.getAllQuery(`
        SELECT * FROM summaries 
        WHERE title LIKE ? OR content LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `, [`%${query}%`, `%${query}%`, limit]);

      return rows;
    } catch (error) {
      this.logger.error('Error searching summaries:', error);
      return [];
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const stats = {};

      // Count records in each table
      const summariesCount = await this.getQuery('SELECT COUNT(*) as count FROM summaries');
      const reportsCount = await this.getQuery('SELECT COUNT(*) as count FROM daily_reports');
      const metadataCount = await this.getQuery('SELECT COUNT(*) as count FROM video_metadata');
      const transcriptsCount = await this.getQuery('SELECT COUNT(*) as count FROM transcripts');

      stats.summaries = summariesCount.count;
      stats.reports = reportsCount.count;
      stats.metadata = metadataCount.count;
      stats.transcripts = transcriptsCount.count;

      // Get database file size
      const dbStats = await fs.stat(this.dbPath);
      stats.dbSize = this.formatBytes(dbStats.size);

      // Get date range
      const dateRange = await this.getQuery(`
        SELECT 
          MIN(DATE(created_at)) as earliest,
          MAX(DATE(created_at)) as latest
        FROM summaries
      `);

      stats.dateRange = dateRange;

      return stats;
    } catch (error) {
      this.logger.error('Error getting database stats:', error);
      return {};
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Health check for database service
   */
  async healthCheck() {
    try {
      await this.getQuery('SELECT 1');
      const stats = await this.getStats();
      
      return {
        status: 'ok',
        database: 'sqlite',
        path: this.dbPath,
        stats
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            this.logger.error('Error closing database:', err);
            reject(err);
          } else {
            this.logger.info('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Create database backup
   */
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(path.dirname(this.dbPath), `backup-${timestamp}.db`);
      
      await fs.copyFile(this.dbPath, backupPath);
      
      this.logger.info(`Database backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      this.logger.error('Error creating database backup:', error);
      throw error;
    }
  }
}

module.exports = DatabaseService;