/**
 * Migrate Transcript Files to Database
 * This script moves all cached transcript files into the database
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { serviceManager } = require('./src/core/service-manager');
const DatabaseService = require('./src/services/database.service');

async function migrateTranscripts() {
  console.log('🔄 TRANSCRIPT MIGRATION TO DATABASE');
  console.log('='.repeat(50));

  try {
    // Initialize database service
    serviceManager.registerService('database', DatabaseService);
    await serviceManager.initializeAll();
    
    const db = await serviceManager.getService('database');
    
    // Find all transcript files
    const cacheDir = path.join(process.cwd(), 'cache');
    const files = await fs.readdir(cacheDir);
    const transcriptFiles = files.filter(f => f.includes('_transcript.json'));
    
    console.log(`📁 Found ${transcriptFiles.length} transcript files to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const file of transcriptFiles) {
      try {
        const filePath = path.join(cacheDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const transcriptData = JSON.parse(content);
        
        // Extract video ID from filename
        const videoId = file.replace('_transcript.json', '');
        
        // Check if transcript already exists in database
        const existing = await db.getTranscript(videoId);
        if (existing) {
          console.log(`⏭️  Skipping ${videoId} (already in database)`);
          skipped++;
          continue;
        }
        
        // Prepare transcript for database
        const transcript = {
          videoId: videoId,
          transcript: transcriptData.transcript || transcriptData.text || JSON.stringify(transcriptData),
          duration: transcriptData.length || transcriptData.duration,
          language: transcriptData.language || 'en',
          source: transcriptData.source || 'cache-migration'
        };
        
        // Save to database
        const saved = await db.saveTranscript(transcript);
        if (saved) {
          console.log(`✅ Migrated ${videoId} (${transcript.transcript.length} chars)`);
          migrated++;
        } else {
          console.log(`❌ Failed to migrate ${videoId}`);
          errors++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 MIGRATION SUMMARY:');
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📁 Total files processed: ${transcriptFiles.length}`);
    
    // Show updated database stats
    console.log('\n📈 UPDATED DATABASE STATS:');
    const stats = await db.getStats();
    console.log(JSON.stringify(stats, null, 2));
    
    // Test search functionality
    console.log('\n🔍 TESTING TRANSCRIPT SEARCH:');
    const searchResults = await db.searchTranscripts('AI', 3);
    searchResults.forEach((result, i) => {
      console.log(`${i + 1}. ${result.title || result.video_id}`);
      console.log(`   Preview: ${result.transcript_text.substring(0, 100)}...`);
    });
    
    console.log('\n🎉 Transcript migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
  
  process.exit(0);
}

migrateTranscripts();