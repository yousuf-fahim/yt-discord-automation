/**
 * Report Service - Daily report generation and management
 */

class ReportService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.summary = dependencies.summary;
    this.cache = dependencies.cache;
    this.logger = serviceManager.logger;
    this.config = serviceManager.config;
  }

  async initialize() {
    this.logger.info('Report service initialized');
  }

  async generateDailyReport() {
    try {
      this.logger.info('Generating daily report...');
      
      // Get summaries from the last 24 hours
      const summaries = await this.getRecentSummaries();
      
      if (summaries.length === 0) {
        return this.generateEmptyReport();
      }

      const report = this.buildReport(summaries);
      
      // Wrap in proper format
      const reportData = {
        data: report,
        timestamp: Date.now()
      };
      
      // Cache the report
      const reportKey = `daily_report_${new Date().toISOString().split('T')[0]}`;
      await this.cache.set(reportKey, reportData);
      
      this.logger.info(`Daily report generated with ${summaries.length} videos`);
      return reportData;
      
    } catch (error) {
      this.logger.error('Daily report generation failed', error);
      throw error;
    }
  }

  async generateWeeklyReport(customPrompt = null) {
    try {
      this.logger.info('Generating weekly report...');
      
      // Get summaries from the last 7 days
      const summaries = await this.getWeeklySummaries();
      
      if (summaries.length === 0) {
        return this.generateEmptyWeeklyReport();
      }

      const report = await this.buildWeeklyReport(summaries, customPrompt);
      
      // Wrap in proper format
      const reportData = {
        data: report,
        timestamp: Date.now(),
        type: 'weekly'
      };
      
      // Cache the report
      const reportKey = `weekly_report_${this.getWeekKey()}`;
      await this.cache.set(reportKey, reportData);
      
      this.logger.info(`Weekly report generated with ${summaries.length} videos`);
      return reportData;
      
    } catch (error) {
      this.logger.error('Weekly report generation failed', error);
      throw error;
    }
  }

  async generateMonthlyReport(customPrompt = null) {
    try {
      this.logger.info('Generating monthly report...');
      
      // Get summaries from the last 30 days
      const summaries = await this.getMonthlySummaries();
      
      if (summaries.length === 0) {
        return this.generateEmptyMonthlyReport();
      }

      const report = await this.buildMonthlyReport(summaries, customPrompt);
      
      // Wrap in proper format
      const reportData = {
        data: report,
        timestamp: Date.now(),
        type: 'monthly'
      };
      
      // Cache the report
      const reportKey = `monthly_report_${this.getMonthKey()}`;
      await this.cache.set(reportKey, reportData);
      
      this.logger.info(`Monthly report generated with ${summaries.length} videos`);
      return reportData;
      
    } catch (error) {
      this.logger.error('Monthly report generation failed', error);
      throw error;
    }
  }

  async getRecentSummaries() {
    try {
      // Get summaries from the last 24 hours
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      console.log('🔍 Report Debug - Looking for summaries:');
      console.log(`📅 Today: ${today.toISOString().split('T')[0]}`);
      console.log(`📅 Yesterday: ${yesterday.toISOString().split('T')[0]}`);
      
      // Get all cached summaries from today and yesterday
      const todaySummaries = await this.getSummariesByDate(today);
      const yesterdaySummaries = await this.getSummariesByDate(yesterday);
      
      console.log(`📊 Today's summaries: ${todaySummaries.length}`);
      console.log(`📊 Yesterday's summaries: ${yesterdaySummaries.length}`);
      
      // Combine and filter to last 24 hours
      const allSummaries = [...todaySummaries, ...yesterdaySummaries];
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      console.log(`🕐 24 hours ago: ${last24Hours.toISOString()}`);
      console.log(`📊 Total summaries before filtering: ${allSummaries.length}`);
      
      const filtered = allSummaries.filter(summary => {
        const hasTimestamp = !!summary.timestamp;
        const isRecent = hasTimestamp && new Date(summary.timestamp) >= last24Hours;
        
        if (!hasTimestamp) {
          console.log(`⚠️ Summary missing timestamp: ${summary.videoId || 'unknown'}`);
        }
        
        return isRecent;
      });
      
      console.log(`📊 Recent summaries (24hrs): ${filtered.length}`);
      
      return filtered;
    } catch (error) {
      this.logger.error('Error getting recent summaries', error);
      return [];
    }
  }

  async getWeeklySummaries() {
    try {
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allSummaries = [];
      
      // Collect summaries from last 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const daySummaries = await this.getSummariesByDate(date);
        // Ensure we have an array before spreading
        if (Array.isArray(daySummaries)) {
          allSummaries.push(...daySummaries);
        }
      }
      
      // Filter to last 7 days with timestamps
      const filtered = allSummaries.filter(summary => {
        return summary && summary.timestamp && new Date(summary.timestamp) >= last7Days;
      });
      
      this.logger.debug(`Weekly summaries collected: ${filtered.length} videos`);
      return filtered;
    } catch (error) {
      this.logger.error('Error getting weekly summaries', error);
      return [];
    }
  }

  async getMonthlySummaries() {
    try {
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const allSummaries = [];
      
      // Collect summaries from last 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const daySummaries = await this.getSummariesByDate(date);
        // Ensure we have an array before spreading
        if (Array.isArray(daySummaries)) {
          allSummaries.push(...daySummaries);
        }
      }
      
      // Filter to last 30 days with timestamps
      const filtered = allSummaries.filter(summary => {
        return summary && summary.timestamp && new Date(summary.timestamp) >= last30Days;
      });
      
      this.logger.debug(`Monthly summaries collected: ${filtered.length} videos`);
      return filtered;
    } catch (error) {
      this.logger.error('Error getting monthly summaries', error);
      return [];
    }
  }

  async saveSummary(videoId, videoTitle, summaryContent, videoUrl) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateStr = today.toISOString().split('T')[0];
      const summaryKey = `summaries_${dateStr}`;
      
      console.log(`💾 Saving summary for ${videoId} to cache key: ${summaryKey}`);
      
      // Get existing summaries for today
      const existingSummaries = await this.getSummariesByDate(today);
      console.log(`📊 Existing summaries for today: ${existingSummaries.length}`);
      
      // Add new summary with consistent field names
      const newSummary = {
        videoId,
        videoTitle, // Use consistent field name
        summaryContent, // Use consistent field name  
        videoUrl, // Use consistent field name
        timestamp: new Date().toISOString()
      };
      
      console.log(`📝 New summary object:`, {
        videoId: newSummary.videoId,
        title: newSummary.videoTitle?.substring(0, 50) + '...',
        contentLength: newSummary.summaryContent?.length,
        timestamp: newSummary.timestamp
      });
      
      // Avoid duplicates
      const filtered = existingSummaries.filter(s => s.videoId !== videoId);
      filtered.push(newSummary);
      
      console.log(`📊 Total summaries after adding: ${filtered.length}`);
      
      // Save back to cache
      const saved = await this.cache.set(summaryKey, filtered);
      console.log(`💾 Cache save result: ${saved}`);
      
      this.logger.info(`Summary saved for video: ${videoTitle}`);
    } catch (error) {
      this.logger.error('Error saving summary', error);
      console.error('💥 Save summary error:', error);
    }
  }

  async sendDailyReport(discordService) {
    try {
      const report = await this.generateDailyReport();
      
      // Send to daily-report channel
      await discordService.sendDailyReport(report);
      
      this.logger.info('Daily report sent successfully');
    } catch (error) {
      this.logger.error('Failed to send daily report', error);
      throw error;
    }
  }

  async getSummariesByDate(date) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const summaryKey = `summaries_${dateStr}`;
      
      const cached = await this.cache.get(summaryKey);
      return cached ? cached : [];
    } catch (error) {
      this.logger.error(`Error getting summaries for ${date}`, error);
      return [];
    }
  }


  buildReport(summaries) {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!summaries || summaries.length === 0) {
      return this.generateEmptyReport();
    }

    let reportText = `📅 **Daily Report - ${date}**\n\n`;
    reportText += `📊 **${summaries.length} video${summaries.length !== 1 ? 's' : ''} processed today**\n\n`;

    summaries.forEach((summary, index) => {
      reportText += `**${index + 1}. ${summary.videoTitle || `Video ${summary.videoId}`}**\n`;
      if (summary.videoUrl) {
        reportText += `🔗 ${summary.videoUrl}\n`;
      }
      reportText += `📝 ${summary.summaryContent}\n\n`;
    });

    reportText += `_Generated at ${new Date().toLocaleTimeString()}_`;

    return {
      data: reportText,
      timestamp: Date.now()
    };
  }

  async buildWeeklyReport(summaries, customPrompt) {
    if (!summaries || summaries.length === 0) {
      return this.generateEmptyWeeklyReport().data;
    }

    // If custom prompt provided, use AI to generate custom report
    if (customPrompt) {
      const summariesData = this.formatSummariesForAI(summaries);
      return await this.summary.generateCustomReport(summariesData, customPrompt);
    }

    // Default weekly report format
    const weekRange = this.getWeekRange();
    let reportText = `📊 **Weekly Report - ${weekRange}**\n\n`;
    reportText += `📈 **${summaries.length} videos processed this week**\n\n`;

    // Group by day
    const byDay = this.groupSummariesByDay(summaries);
    
    Object.keys(byDay).sort().forEach(day => {
      const daySummaries = byDay[day];
      reportText += `**${day} (${daySummaries.length} videos)**\n`;
      daySummaries.forEach(summary => {
        reportText += `• ${summary.videoTitle || `Video ${summary.videoId}`}\n`;
      });
      reportText += '\n';
    });

    reportText += `_Generated at ${new Date().toLocaleString()}_`;
    return reportText;
  }

  async buildMonthlyReport(summaries, customPrompt) {
    if (!summaries || summaries.length === 0) {
      return this.generateEmptyMonthlyReport().data;
    }

    // If custom prompt provided, use AI to generate custom report
    if (customPrompt) {
      const summariesData = this.formatSummariesForAI(summaries);
      return await this.summary.generateCustomReport(summariesData, customPrompt);
    }

    // Default monthly report format
    const monthRange = this.getMonthRange();
    let reportText = `📊 **Monthly Report - ${monthRange}**\n\n`;
    reportText += `📈 **${summaries.length} videos processed this month**\n\n`;

    // Group by week
    const byWeek = this.groupSummariesByWeek(summaries);
    
    Object.keys(byWeek).sort().forEach(week => {
      const weekSummaries = byWeek[week];
      reportText += `**Week ${week} (${weekSummaries.length} videos)**\n`;
      weekSummaries.forEach(summary => {
        reportText += `• ${summary.videoTitle || `Video ${summary.videoId}`}\n`;
      });
      reportText += '\n';
    });

    reportText += `_Generated at ${new Date().toLocaleString()}_`;
    return reportText;
  }

  generateEmptyReport() {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const reportText = `📅 **${date}**\n\n` +
           `No activity today - no YouTube videos were processed in the last 24 hours.\n\n` +
           `🔄 The bot is running normally and ready to process new videos.`;
           
    return {
      data: reportText,
      timestamp: Date.now()
    };
  }

  generateEmptyWeeklyReport() {
    const weekRange = this.getWeekRange();
    const reportText = `📊 **Weekly Report - ${weekRange}**\n\n` +
           `No activity this week - no YouTube videos were processed in the last 7 days.\n\n` +
           `🔄 The bot is running normally and ready to process new videos.`;
           
    return {
      data: reportText,
      timestamp: Date.now(),
      type: 'weekly'
    };
  }

  generateEmptyMonthlyReport() {
    const monthRange = this.getMonthRange();
    const reportText = `📊 **Monthly Report - ${monthRange}**\n\n` +
           `No activity this month - no YouTube videos were processed in the last 30 days.\n\n` +
           `🔄 The bot is running normally and ready to process new videos.`;
           
    return {
      data: reportText,
      timestamp: Date.now(),
      type: 'monthly'
    };
  }

  formatSummariesForAI(summaries) {
    return summaries.map(summary => ({
      title: summary.videoTitle || 'Unknown Title',
      url: summary.videoUrl || '',
      summary: summary.summaryContent || '',
      date: summary.timestamp ? new Date(summary.timestamp).toLocaleDateString() : 'Unknown date'
    })).map(s => `**${s.title}** (${s.date})\n${s.url}\n${s.summary}\n`).join('\n---\n\n');
  }

  groupSummariesByDay(summaries) {
    const groups = {};
    summaries.forEach(summary => {
      if (summary.timestamp) {
        const day = new Date(summary.timestamp).toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        });
        if (!groups[day]) groups[day] = [];
        groups[day].push(summary);
      }
    });
    return groups;
  }

  groupSummariesByWeek(summaries) {
    const groups = {};
    summaries.forEach(summary => {
      if (summary.timestamp) {
        const date = new Date(summary.timestamp);
        const weekNum = this.getWeekNumber(date);
        if (!groups[weekNum]) groups[weekNum] = [];
        groups[weekNum].push(summary);
      }
    });
    return groups;
  }

  getWeekRange() {
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return `${start.toLocaleDateString()} - ${now.toLocaleDateString()}`;
  }

  getMonthRange() {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return `${start.toLocaleDateString()} - ${now.toLocaleDateString()}`;
  }

  getWeekKey() {
    const now = new Date();
    const year = now.getFullYear();
    const week = this.getWeekNumber(now);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  getMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  async healthCheck() {
    return {
      status: 'ok',
      lastReportGenerated: 'Not implemented yet'
    };
  }
}

module.exports = ReportService;
