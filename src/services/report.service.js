/**
 * Report Service - Daily report generation and management
 */

class ReportService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.summary = dependencies.summary;
    this.cache = dependencies.cache;
    this.database = dependencies.database;
    this.logger = serviceManager.logger;
    this.config = serviceManager.config;
  }

  async initialize() {
    this.logger.info('Report service initialized with database support');
  }

  async generateDailyReport() {
    try {
      this.logger.info('Generating daily report...');
      
      // Get summaries from the last 24 hours
      const summaries = await this.getRecentSummaries();
      
      const today = new Date().toISOString().split('T')[0];
      
      if (summaries.length === 0) {
        const emptyReportText = this.generateEmptyReport().data;
        
        const emptyReport = {
          data: emptyReportText,
          timestamp: Date.now(),
          type: 'daily',
          summaryCount: 0
        };
        
        // Cache the empty report
        const reportKey = `daily_report_${today}`;
        await this.cache.set(reportKey, emptyReport);
        
        // Save to database
        if (this.database) {
          await this.database.saveDailyReport({
            date: today,
            content: emptyReportText,
            summaryCount: 0
          });
        }
        
        return emptyReport;
      }

      const report = this.buildReport(summaries);
      
      // Wrap in proper format
      const reportData = {
        data: report,
        timestamp: Date.now(),
        type: 'daily',
        summaryCount: summaries.length
      };
      
      // Cache the report
      const reportKey = `daily_report_${today}`;
      const cacheSuccess = await this.cache.set(reportKey, reportData);
      
      // Save to database
      if (this.database) {
        await this.database.saveDailyReport({
          date: today,
          content: report,
          summaryCount: summaries.length
        });
      }
      
      if (cacheSuccess) {
        this.logger.info(`Daily report generated, cached, and saved to database with ${summaries.length} videos`);
      } else {
        this.logger.warn(`Daily report generated and saved to database, but caching failed`);
      }
      
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
      console.log('🔍 Report Debug - Database-first approach:');
      
      // DATABASE-FIRST: Always check database first for recent summaries
      if (this.database) {
        console.log('� Checking database for recent summaries...');
        const dbSummaries = await this.database.getRecentSummaries(72); // Temporarily using 72 hours to test with Oct 6th data
        
        if (dbSummaries && dbSummaries.length > 0) {
          // Convert database format to expected format
          const summaries = dbSummaries.map(row => ({
            videoId: row.video_id,
            videoTitle: row.title,
            summaryContent: row.content,
            videoUrl: row.url,
            timestamp: row.created_at
          }));
          
          console.log(`📊 Database found ${summaries.length} recent summaries`);
          return summaries;
        } else {
          console.log('📊 Database found 0 recent summaries');
        }
      }
      
      // FALLBACK: Only use cache if database is unavailable or has no data
      console.log('📦 Falling back to cache...');
      
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const today = new Date(todayStr);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      console.log(`� Checking cache for: ${todayStr} and ${yesterday.toISOString().split('T')[0]}`);
      
      const todaySummaries = await this.getSummariesByDate(today);
      const yesterdaySummaries = await this.getSummariesByDate(yesterday);
      
      const allSummaries = [...todaySummaries, ...yesterdaySummaries];
      console.log(`📊 Cache found ${allSummaries.length} summaries`);
      
      // Filter to last 24 hours
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const filtered = allSummaries.filter(summary => {
        return summary && summary.timestamp && new Date(summary.timestamp) >= last24Hours;
      });
      
      console.log(`📊 Cache filtered to ${filtered.length} recent summaries`);
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

  async saveSummary(summary) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheService = await this.serviceManager.getService('cache');
      
      if (!cacheService) {
        this.logger.error('Cache service not available');
        return false;
      }
      
      // Save to database first (persistent storage)
      if (this.database) {
        await this.database.saveSummary({
          videoId: summary.videoId,
          videoTitle: summary.videoTitle,
          summaryContent: summary.summaryContent,
          videoUrl: summary.videoUrl,
          promptType: summary.promptType || 'default'
        });
        this.logger.info(`Summary saved to database: ${summary.videoId}`);
      }
      
      // Then save to cache (fast access)
      // Retrieve existing summaries for today
      const existingCache = await cacheService.get(`summaries_${today}`);
      
      // Handle both old format (array) and new format ({data: array, timestamp: number})
      let todaySummaries = [];
      if (Array.isArray(existingCache)) {
        // Old format - convert to new format
        todaySummaries = existingCache;
      } else if (existingCache && existingCache.data && Array.isArray(existingCache.data)) {
        // New format
        todaySummaries = existingCache.data;
      }
      
      // Add new summary
      const newSummary = {
        videoId: summary.videoId,
        videoTitle: summary.videoTitle,
        summaryContent: summary.summaryContent,
        videoUrl: summary.videoUrl,
        timestamp: new Date().toISOString()
      };
      
      todaySummaries.push(newSummary);
      
      // Save in new standardized format
      const summaryData = {
        data: todaySummaries,
        timestamp: Date.now(),
        type: 'summaries',
        date: today
      };
      
      await cacheService.set(`summaries_${today}`, summaryData);
      
      this.logger.info(`Summary saved to cache and database: ${summary.videoId}`);
      return true;
    } catch (error) {
      this.logger.error('Error saving summary:', error);
      return false;
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
      
      // Handle both old format (array) and new format ({data: array, timestamp: number})
      if (Array.isArray(cached)) {
        return cached;
      } else if (cached && cached.data && Array.isArray(cached.data)) {
        return cached.data;
      }
      return [];
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
      const emptyReport = this.generateEmptyReport();
      return emptyReport.data; // Return just the text, not the wrapper
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

    return reportText; // Return just the text
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

  /**
   * Generate weekly report (Monday to Sunday)
   */
  async generateWeeklyReport(weekOffset = 0) {
    try {
      this.logger.info('Generating weekly report...');

      // Calculate week start (Monday) and end (Sunday)
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const mondayOffset = currentDay === 0 ? -6 : -(currentDay - 1); // Adjust to get Monday
      
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset - (weekOffset * 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // Get summaries for the week
      const summaries = await this.getSummariesInDateRange(weekStart, weekEnd);
      
      if (summaries.length === 0) {
        const emptyReport = this.generateEmptyWeeklyReport(weekStartStr, weekEndStr);
        await this.saveWeeklyReport(weekStartStr, weekEndStr, emptyReport, 0, []);
        return emptyReport;
      }

      // Analyze weekly data
      const weeklyAnalytics = this.analyzeWeeklyData(summaries);
      const reportContent = await this.generateWeeklyReportContent(summaries, weeklyAnalytics, weekStartStr, weekEndStr);

      // Save to cache and database
      await this.saveWeeklyReport(weekStartStr, weekEndStr, reportContent, summaries.length, weeklyAnalytics.topChannels);

      this.logger.info(`Weekly report generated and saved: ${weekStartStr} to ${weekEndStr}`);
      return reportContent;

    } catch (error) {
      this.logger.error('Error generating weekly report:', error);
      throw error;
    }
  }

  /**
   * Generate monthly report
   */
  async generateMonthlyReport(monthOffset = 0) {
    try {
      this.logger.info('Generating monthly report...');

      // Calculate month start and end
      const now = new Date();
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

      const year = monthStart.getFullYear();
      const month = monthStart.getMonth() + 1;
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      // Get summaries for the month
      const summaries = await this.getSummariesInDateRange(monthStart, monthEnd);
      
      if (summaries.length === 0) {
        const emptyReport = this.generateEmptyMonthlyReport(monthName);
        await this.saveMonthlyReport(year, month, monthName, emptyReport, 0, [], 0, {});
        return emptyReport;
      }

      // Analyze monthly data
      const monthlyAnalytics = this.analyzeMonthlyData(summaries, monthStart, monthEnd);
      const reportContent = await this.generateMonthlyReportContent(summaries, monthlyAnalytics, monthName);

      // Save to cache and database
      await this.saveMonthlyReport(
        year, 
        month, 
        monthName, 
        reportContent, 
        summaries.length, 
        monthlyAnalytics.topChannels,
        monthlyAnalytics.dailyAverage,
        monthlyAnalytics.weeklyBreakdown
      );

      this.logger.info(`Monthly report generated and saved: ${monthName}`);
      return reportContent;

    } catch (error) {
      this.logger.error('Error generating monthly report:', error);
      throw error;
    }
  }

  /**
   * Get summaries within a date range
   */
  async getSummariesInDateRange(startDate, endDate) {
    try {
      // Try database first
      if (this.database) {
        const dbSummaries = await this.database.getAllQuery(`
          SELECT * FROM summaries 
          WHERE created_at >= ? AND created_at <= ?
          ORDER BY created_at DESC
        `, [startDate.toISOString(), endDate.toISOString()]);
        
        if (dbSummaries && dbSummaries.length > 0) {
          return dbSummaries;
        }
      }

      // Fallback to cache scanning
      return await this.scanCacheForDateRange(startDate, endDate);
    } catch (error) {
      this.logger.error('Error getting summaries in date range:', error);
      return [];
    }
  }

  /**
   * Analyze weekly data for insights
   */
  analyzeWeeklyData(summaries) {
    const channelCount = {};
    const dailyCount = {};
    const topics = [];

    summaries.forEach(summary => {
      // Count by channel
      const channel = summary.channel_name || 'Unknown';
      channelCount[channel] = (channelCount[channel] || 0) + 1;

      // Count by day
      const day = new Date(summary.created_at || summary.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
      dailyCount[day] = (dailyCount[day] || 0) + 1;

      // Extract topics (basic implementation)
      if (summary.title) {
        topics.push(...summary.title.toLowerCase().split(' ').filter(word => word.length > 4));
      }
    });

    const topChannels = Object.entries(channelCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([channel, count]) => ({ channel, count }));

    return {
      topChannels,
      dailyBreakdown: dailyCount,
      totalVideos: summaries.length,
      avgPerDay: Math.round(summaries.length / 7 * 10) / 10,
      topTopics: [...new Set(topics)].slice(0, 10)
    };
  }

  /**
   * Analyze monthly data for insights
   */
  analyzeMonthlyData(summaries, monthStart, monthEnd) {
    const weeklyData = this.analyzeWeeklyData(summaries);
    const daysInMonth = new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 1, 0).getDate();
    
    // Weekly breakdown
    const weeklyBreakdown = {};
    const weeks = Math.ceil(daysInMonth / 7);
    
    for (let week = 1; week <= weeks; week++) {
      const weekStartDay = (week - 1) * 7 + 1;
      const weekEndDay = Math.min(week * 7, daysInMonth);
      
      const weekSummaries = summaries.filter(s => {
        const day = new Date(s.created_at || s.timestamp).getDate();
        return day >= weekStartDay && day <= weekEndDay;
      });
      
      weeklyBreakdown[`Week ${week}`] = {
        videos: weekSummaries.length,
        days: `${weekStartDay}-${weekEndDay}`
      };
    }

    return {
      ...weeklyData,
      dailyAverage: Math.round(summaries.length / daysInMonth * 10) / 10,
      weeklyBreakdown,
      daysInMonth
    };
  }

  /**
   * Generate weekly report content
   */
  async generateWeeklyReportContent(summaries, analytics, weekStart, weekEnd) {
    const prompt = await this.loadPrompt('weekly-report-prompt');
    
    const reportData = {
      weekStart,
      weekEnd,
      summaries,
      analytics,
      totalVideos: summaries.length,
      topChannels: analytics.topChannels,
      dailyBreakdown: analytics.dailyBreakdown
    };

    // Use AI to generate the report if available, otherwise use template
    if (this.summary && prompt) {
      try {
        const aiReport = await this.summary.generateSummary(
          JSON.stringify(reportData, null, 2),
          `Weekly Report: ${weekStart} to ${weekEnd}`,
          null,
          prompt
        );
        return aiReport.summary || this.generateWeeklyTemplate(reportData);
      } catch (error) {
        this.logger.warn('AI weekly report generation failed, using template:', error.message);
        return this.generateWeeklyTemplate(reportData);
      }
    }

    return this.generateWeeklyTemplate(reportData);
  }

  /**
   * Generate monthly report content
   */
  async generateMonthlyReportContent(summaries, analytics, monthName) {
    const prompt = await this.loadPrompt('monthly-report-prompt');
    
    const reportData = {
      monthName,
      summaries,
      analytics,
      totalVideos: summaries.length,
      dailyAverage: analytics.dailyAverage,
      weeklyBreakdown: analytics.weeklyBreakdown,
      topChannels: analytics.topChannels
    };

    // Use AI to generate the report if available, otherwise use template
    if (this.summary && prompt) {
      try {
        const aiReport = await this.summary.generateSummary(
          JSON.stringify(reportData, null, 2),
          `Monthly Report: ${monthName}`,
          null,
          prompt
        );
        return aiReport.summary || this.generateMonthlyTemplate(reportData);
      } catch (error) {
        this.logger.warn('AI monthly report generation failed, using template:', error.message);
        return this.generateMonthlyTemplate(reportData);
      }
    }

    return this.generateMonthlyTemplate(reportData);
  }

  /**
   * Save weekly report
   */
  async saveWeeklyReport(weekStart, weekEnd, content, summaryCount, topChannels) {
    const reportKey = `weekly_report_${weekStart}`;
    
    const report = {
      weekStart,
      weekEnd,
      content,
      summaryCount,
      totalVideos: summaryCount,
      topChannels,
      timestamp: Date.now(),
      type: 'weekly'
    };

    // Save to cache
    await this.cache.set(reportKey, report);

    // Save to database
    if (this.database) {
      await this.database.saveWeeklyReport({
        weekStart,
        weekEnd,
        content,
        summaryCount,
        totalVideos: summaryCount,
        topChannels
      });
    }

    this.logger.info(`Weekly report saved to cache and database: ${weekStart}`);
    return true;
  }

  /**
   * Save monthly report
   */
  async saveMonthlyReport(year, month, monthName, content, summaryCount, topChannels, dailyAverage, weeklyBreakdown) {
    const reportKey = `monthly_report_${year}-${month.toString().padStart(2, '0')}`;
    
    const report = {
      year,
      month,
      monthName,
      content,
      summaryCount,
      topChannels,
      dailyAverage,
      weeklyBreakdown,
      timestamp: Date.now(),
      type: 'monthly'
    };

    // Save to cache
    await this.cache.set(reportKey, report);

    // Save to database
    if (this.database) {
      await this.database.saveMonthlyReport({
        year,
        month,
        monthName,
        content,
        summaryCount,
        totalVideos: summaryCount,
        topChannels,
        dailyAverage,
        weeklyBreakdown
      });
    }

    this.logger.info(`Monthly report saved to cache and database: ${monthName}`);
    return true;
  }

  /**
   * Template generators for fallback
   */
  generateWeeklyTemplate(data) {
    return `# Weekly YouTube Summary Report
**Week: ${data.weekStart} to ${data.weekEnd}**

## 📊 Overview
- **Total Videos**: ${data.totalVideos}
- **Average per Day**: ${data.analytics.avgPerDay}

## 🏆 Top Channels
${data.topChannels.map((ch, i) => `${i + 1}. **${ch.channel}** (${ch.count} videos)`).join('\n')}

## 📅 Daily Breakdown
${Object.entries(data.dailyBreakdown).map(([day, count]) => `- **${day}**: ${count} videos`).join('\n')}

Generated on ${new Date().toLocaleString()}`;
  }

  generateMonthlyTemplate(data) {
    return `# Monthly YouTube Summary Report
**Month: ${data.monthName}**

## 📊 Overview
- **Total Videos**: ${data.totalVideos}
- **Daily Average**: ${data.dailyAverage}
- **Days in Month**: ${data.analytics.daysInMonth}

## 🏆 Top Channels
${data.topChannels.map((ch, i) => `${i + 1}. **${ch.channel}** (${ch.count} videos)`).join('\n')}

## 📈 Weekly Breakdown
${Object.entries(data.weeklyBreakdown).map(([week, info]) => `- **${week}**: ${info.videos} videos (Days ${info.days})`).join('\n')}

Generated on ${new Date().toLocaleString()}`;
  }

  generateEmptyWeeklyReport(weekStart, weekEnd) {
    return `# Weekly YouTube Summary Report
**Week: ${weekStart} to ${weekEnd}**

## 📊 Overview
No videos were processed during this week.

**Stay tuned for next week's content!**

Generated on ${new Date().toLocaleString()}`;
  }

  generateEmptyMonthlyReport(monthName) {
    return `# Monthly YouTube Summary Report
**Month: ${monthName}**

## 📊 Overview
No videos were processed during this month.

**Stay tuned for upcoming content!**

Generated on ${new Date().toLocaleString()}`;
  }

  /**
   * Load prompt from prompts directory
   */
  async loadPrompt(promptName) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const promptPath = path.join(process.cwd(), 'prompts', `${promptName}.md`);
      const promptContent = await fs.readFile(promptPath, 'utf8');
      
      return promptContent;
    } catch (error) {
      this.logger.warn(`Could not load prompt ${promptName}:`, error.message);
      return null;
    }
  }

  /**
   * Scan cache for summaries in date range (fallback method)
   */
  async scanCacheForDateRange(startDate, endDate) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const cacheDir = path.join(process.cwd(), 'cache');
      const files = await fs.readdir(cacheDir);
      const summaries = [];

      for (const file of files) {
        if (!file.includes('summary_') || !file.endsWith('.json')) continue;

        try {
          const filePath = path.join(cacheDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime >= startDate && stats.mtime <= endDate) {
            const data = await fs.readFile(filePath, 'utf8');
            const summary = JSON.parse(data);
            summaries.push(summary);
          }
        } catch (e) {
          // Skip corrupted files
        }
      }

      return summaries;
    } catch (error) {
      this.logger.error('Error scanning cache for date range:', error);
      return [];
    }
  }

  async healthCheck() {
    return {
      status: 'ok',
      lastReportGenerated: 'Not implemented yet'
    };
  }

  /**
   * Send daily report to Discord channel (for command service compatibility)
   */
  async sendDailyReport(discordService) {
    try {
      // Generate the daily report
      const reportContent = await this.generateDailyReport();
      
      if (!reportContent) {
        throw new Error('Failed to generate daily report');
      }
      
      // Get the report content (handle both old and new format)
      const content = reportContent.data || reportContent;
      
      // Get the guild
      const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
      if (!guild) {
        throw new Error('Guild not found');
      }
      
      // Find the daily report channel
      const reportChannel = guild.channels.cache.find(
        ch => ch.name === discordService.config.channels.dailyReport
      );
      
      if (!reportChannel) {
        throw new Error(`Daily report channel '${discordService.config.channels.dailyReport}' not found`);
      }
      
      // Send the report
      const today = new Date().toISOString().split('T')[0];
      await discordService.sendLongMessage(reportChannel, content, {
        fileName: `daily_report_${today}`,
        fileFormat: 'txt'
      });
      
      this.logger.info('Daily report sent to Discord channel');
      return true;
    } catch (error) {
      this.logger.error('Error sending daily report to Discord:', error);
      throw error;
    }
  }
}

module.exports = ReportService;
