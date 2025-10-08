const fs = require('fs');
const path = require('path');
const ServiceManager = require('./src/core/service-manager');

async function migrateAllDataToDatabase() {
  try {
    console.log('🗄️ Migrating ALL cache data to database...\n');

    // Initialize services
    process.env.NODE_ENV = 'test';
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.DISCORD_GUILD_ID = 'test-guild';
    process.env.OPENAI_API_KEY = 'test-key';

    const serviceManager = new ServiceManager();
    await serviceManager.initializeAll();
    const database = await serviceManager.getService('database');

    // 1. Migrate Summaries from cache
    console.log('📝 Migrating summaries...');
    const cacheDir = './cache';
    const summaryFiles = fs.readdirSync(cacheDir).filter(f => f.startsWith('summaries_') && f.endsWith('.json'));
    
    let totalSummaries = 0;
    for (const file of summaryFiles) {
      const filePath = path.join(cacheDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const summaries = Array.isArray(data) ? data : (data.data || []);
      
      console.log(`  Processing ${file}: ${summaries.length} summaries`);
      
      for (const summary of summaries) {
        try {
          await database.saveSummary({
            videoId: summary.videoId,
            videoTitle: summary.videoTitle,
            summaryContent: summary.summaryContent,
            videoUrl: summary.videoUrl,
            promptType: 'default'
          });
          totalSummaries++;
        } catch (error) {
          console.log(`    ⚠️ Error saving ${summary.videoId}: ${error.message}`);
        }
      }
    }
    console.log(`✅ Migrated ${totalSummaries} summaries\n`);

    // 2. Migrate Transcripts from cache  
    console.log('📜 Migrating transcripts...');
    const transcriptFiles = fs.readdirSync(cacheDir).filter(f => f.endsWith('_transcript.json'));
    
    let totalTranscripts = 0;
    for (const file of transcriptFiles) {
      const videoId = file.replace('_transcript.json', '');
      const filePath = path.join(cacheDir, file);
      
      try {
        const transcript = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        await database.saveTranscript({
          videoId: videoId,
          content: JSON.stringify(transcript),
          source: 'cache_migration',
          language: 'en'
        });
        totalTranscripts++;
        console.log(`  ✅ Migrated transcript: ${videoId}`);
      } catch (error) {
        console.log(`  ⚠️ Error migrating transcript ${videoId}: ${error.message}`);
      }
    }
    console.log(`✅ Migrated ${totalTranscripts} transcripts\n`);

    // 3. Migrate Reports from cache
    console.log('📊 Migrating reports...');
    const reportFiles = fs.readdirSync(cacheDir).filter(f => 
      f.startsWith('daily_report_') || f.startsWith('weekly_report_') || f.startsWith('monthly_report_')
    );
    
    let totalReports = 0;
    for (const file of reportFiles) {
      const filePath = path.join(cacheDir, file);
      
      try {
        const report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const content = typeof report === 'string' ? report : (report.data || JSON.stringify(report));
        
        if (file.startsWith('daily_report_')) {
          const date = file.replace('daily_report_', '').replace('.json', '');
          await database.saveDailyReport({
            date: date,
            content: content,
            summaryCount: report.summaryCount || 0
          });
        } else if (file.startsWith('weekly_report_')) {
          // Handle weekly reports
          const dateStr = file.replace('weekly_report_', '').replace('.json', '');
          const weekStart = new Date(dateStr);
          const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
          
          await database.saveWeeklyReport(weekStart, weekEnd, content, report.summaryCount || 0, []);
        } else if (file.startsWith('monthly_report_')) {
          // Handle monthly reports  
          const dateStr = file.replace('monthly_report_', '').replace('.json', '');
          const [year, month] = dateStr.split('-');
          
          await database.saveMonthlyReport(
            parseInt(year), parseInt(month), 
            new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
            content, report.summaryCount || 0, [], 0, []
          );
        }
        
        totalReports++;
        console.log(`  ✅ Migrated report: ${file}`);
      } catch (error) {
        console.log(`  ⚠️ Error migrating report ${file}: ${error.message}`);
      }
    }
    console.log(`✅ Migrated ${totalReports} reports\n`);

    // 4. Summary of database state
    console.log('📋 Final database state:');
    const summariesCount = await database.getAllQuery('SELECT COUNT(*) as count FROM summaries', []);
    const transcriptsCount = await database.getAllQuery('SELECT COUNT(*) as count FROM transcripts', []);
    const dailyReportsCount = await database.getAllQuery('SELECT COUNT(*) as count FROM daily_reports', []);
    const weeklyReportsCount = await database.getAllQuery('SELECT COUNT(*) as count FROM weekly_reports', []);
    const monthlyReportsCount = await database.getAllQuery('SELECT COUNT(*) as count FROM monthly_reports', []);

    console.log(`  Summaries: ${summariesCount[0].count}`);
    console.log(`  Transcripts: ${transcriptsCount[0].count}`);
    console.log(`  Daily Reports: ${dailyReportsCount[0].count}`);
    console.log(`  Weekly Reports: ${weeklyReportsCount[0].count}`);
    console.log(`  Monthly Reports: ${monthlyReportsCount[0].count}`);

    console.log('\n🎉 Migration completed! All cache data is now in the database.');

  } catch (error) {
    console.error('Migration error:', error);
  }
}

migrateAllDataToDatabase();