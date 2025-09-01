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
      
      // Cache the report
      const reportKey = `daily_report_${new Date().toISOString().split('T')[0]}`;
      await this.cache.set(reportKey, report);
      
      this.logger.info(`Daily report generated with ${summaries.length} videos`);
      return report;
      
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
      
      // Get all cached summaries from today and yesterday
      const todaySummaries = await this.getSummariesByDate(today);
      const yesterdaySummaries = await this.getSummariesByDate(yesterday);
      
      // Combine and filter to last 24 hours
      const allSummaries = [...todaySummaries, ...yesterdaySummaries];
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      return allSummaries.filter(summary => 
        summary.timestamp && new Date(summary.timestamp) >= last24Hours
      );
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
      
      // Get existing summaries for today
      const existingSummaries = await this.getSummariesByDate(today);
      
      // Add new summary
      const newSummary = {
        videoId,
        title: videoTitle,
        content: summaryContent,
        url: videoUrl,
        timestamp: new Date().toISOString()
      };
      
      // Avoid duplicates
      const filtered = existingSummaries.filter(s => s.videoId !== videoId);
      filtered.push(newSummary);
      
      // Save back to cache
      await this.cache.set(summaryKey, filtered);
      
      this.logger.info(`Summary saved for video: ${videoTitle}`);
    } catch (error) {
      this.logger.error('Error saving summary', error);
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

  generateEmptyReport() {
    const date = new Date().toLocaleDateString();
    return `📊 **Daily YouTube Summary Report - ${date}**\n\n` +
           `No videos were processed in the last 24 hours.\n\n` +
           `📅 Generated on ${new Date().toLocaleString()}`;
  }

  async healthCheck() {
    return {
      status: 'ok',
      lastReportGenerated: 'Not implemented yet'
    };
  }
}

module.exports = ReportService;
