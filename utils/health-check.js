const { getDailyStats } = require('./monitoring');

class HealthCheck {
    constructor() {
        this.lastStatusMessage = null;
        this.lastCheck = null;
        this.status = {
            isHealthy: true,
            lastError: null,
            startTime: new Date(),
            checks: {
                discord: true,
                transcripts: true,
                summaries: true,
                reports: true
            }
        };
    }

    updateHealth(component, isHealthy, error = null) {
        this.status.checks[component] = isHealthy;
        this.status.isHealthy = Object.values(this.status.checks).every(check => check);
        if (!isHealthy) {
            this.status.lastError = {
                component,
                error: error?.message || error,
                timestamp: new Date()
            };
        }
    }

    async generateStatusMessage(client, channel) {
        const stats = getDailyStats();
        const uptime = Math.floor((new Date() - this.status.startTime) / 1000 / 60); // minutes
        
        // Delete previous status message
        if (this.lastStatusMessage) {
            try {
                await this.lastStatusMessage.delete();
            } catch (error) {
                console.log('Could not delete previous status message:', error.message);
            }
        }

        // Calculate next report time
        const nextReport = new Date();
        nextReport.setHours(process.env.DAILY_REPORT_HOUR || 18);
        nextReport.setMinutes(process.env.DAILY_REPORT_MINUTE || 0);
        nextReport.setSeconds(0);
        if (nextReport < new Date()) nextReport.setDate(nextReport.getDate() + 1);

        // Generate status message
        const statusEmoji = this.status.isHealthy ? '🟢' : '🔴';
        const message = await channel.send({
            content: [
                `${statusEmoji} **Bot Status Update**`,
                `Uptime: ${uptime} minutes`,
                '',
                '**Today's Activity:**',
                `• Summaries Generated: ${stats.summaries.count || 0}`,
                `• Unique Videos Processed: ${stats.summaries.videos?.size || 0}`,
                `• Transcript Success Rate: ${Math.round((stats.transcripts.successful / stats.transcripts.total) * 100 || 0)}%`,
                '',
                `Last Report Generated: ${stats.reports.lastGenerated ? new Date(stats.reports.lastGenerated).toLocaleString() : 'None'}`,
                `Next Report Scheduled: ${nextReport.toLocaleString('en-US', {
                    timeZone: 'Europe/Paris',
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                })}`,
                '',
                this.status.lastError ? 
                    `⚠️ Last Error (${this.status.lastError.component}): ${this.status.lastError.error}` : 
                    '✅ No recent errors'
            ].join('\n'),
            flags: ['SuppressNotifications']
        });

        this.lastStatusMessage = message;
        this.lastCheck = new Date();
        
        return message;
    }
}

// Export singleton instance
module.exports = new HealthCheck();
