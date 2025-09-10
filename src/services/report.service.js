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
    
    let report = `📊 **Daily YouTube Summary Report - ${date}**\n\n`;
    report += `📈 Total videos processed: **${summaries.length}**\n\n`;
    
    if (summaries.length > 0) {
      summaries.forEach((summary, index) => {
        const timeStr = summary.timestamp ? 
          new Date(summary.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : 'Unknown time';
        
        report += `**${index + 1}. ${summary.title || 'Unknown Video'}**\n`;
        report += `🕒 Processed at: ${timeStr}\n`;
        
        // Add summary preview (first 200 chars)
        if (summary.content) {
          const preview = summary.content.length > 200 ? 
            summary.content.substring(0, 200) + '...' : 
            summary.content;
          report += `📝 ${preview}\n`;
        }
        
        if (summary.url) {
          report += `🔗 ${summary.url}\n`;
        }
        report += '\n';
      });
    }
    
    report += `\n📅 Generated on ${new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })}`;
    
    return report;
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

  async healthCheck() {
    return {
      status: 'ok',
      lastReportGenerated: 'Not implemented yet'
    };
  }
}

module.exports = ReportService;
