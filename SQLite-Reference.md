# 🗄️ SQLite Quick Reference for YouTube Discord Bot

## 📍 Database Location
Your database: `/Users/fahim/yt-discord-automation/data/bot.db`

## � Database Schema
- **`summaries`** - AI-generated video summaries
- **`transcripts`** - Full video transcripts (NEW!)
- **`daily_reports`** - Generated daily reports  
- **`analytics`** - Performance and usage tracking
- **`video_metadata`** - Additional video information
- **`system_logs`** - Error tracking and debugging

## �🔧 Basic Commands

### Start SQLite
```bash
cd /Users/fahim/yt-discord-automation
sqlite3 data/bot.db
```

### Essential .commands (start with dot)
```sql
.tables                    -- List all tables
.schema summaries          -- Show table structure
.schema transcripts        -- Show transcript table structure  
.headers on               -- Show column headers
.mode column              -- Pretty column formatting
.quit                     -- Exit SQLite
```

## 📊 Useful Queries

### Summary Data
```sql
-- Count all summaries
SELECT COUNT(*) FROM summaries;

-- Recent summaries (last 10)
SELECT video_id, title, created_at 
FROM summaries 
ORDER BY created_at DESC 
LIMIT 10;

-- Search for AI-related videos
SELECT title, video_id, created_at
FROM summaries 
WHERE title LIKE '%AI%' OR content LIKE '%AI%';

-- Today's summaries
SELECT COUNT(*) as today_count
FROM summaries 
WHERE DATE(created_at) = DATE('now');

-- Summary stats by word count
SELECT 
  MIN(word_count) as min_words,
  MAX(word_count) as max_words,
  AVG(word_count) as avg_words
FROM summaries;
```

### 🎬 Transcript Data (NEW!)
```sql
-- Count all transcripts
SELECT COUNT(*) FROM transcripts;

-- Transcript statistics
SELECT 
  COUNT(*) as total_transcripts,
  SUM(word_count) as total_words,
  AVG(word_count) as avg_words,
  MIN(word_count) as min_words,
  MAX(word_count) as max_words
FROM transcripts;

-- Recent transcripts
SELECT video_id, word_count, created_at
FROM transcripts 
ORDER BY created_at DESC 
LIMIT 10;

-- Search transcript content
SELECT t.video_id, t.word_count, s.title
FROM transcripts t
LEFT JOIN summaries s ON t.video_id = s.video_id
WHERE t.transcript_text LIKE '%programming%'
LIMIT 5;

-- Longest transcripts
SELECT video_id, word_count, 
       substr(transcript_text, 1, 100) || '...' as preview
FROM transcripts 
ORDER BY word_count DESC 
LIMIT 5;

-- Find videos with both summaries and transcripts
SELECT s.video_id, s.title, s.word_count as summary_words, 
       t.word_count as transcript_words
FROM summaries s
INNER JOIN transcripts t ON s.video_id = t.video_id
ORDER BY t.word_count DESC;
```

### Daily Reports
```sql
-- All daily reports
SELECT date, summary_count, word_count, created_at
FROM daily_reports
ORDER BY date DESC;

-- Latest report
SELECT * FROM daily_reports 
ORDER BY created_at DESC 
LIMIT 1;
```

### Analytics
```sql
-- Performance analytics
SELECT date, videos_processed, total_summaries, avg_summary_length
FROM analytics
ORDER BY date DESC;

-- Total videos processed
SELECT SUM(videos_processed) as total_videos
FROM analytics;
```

### Advanced Queries
```sql
-- Most active days
SELECT 
  date,
  COUNT(*) as summaries_created
FROM summaries
WHERE created_at >= datetime('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY summaries_created DESC;

-- Content analysis (find trending topics)
SELECT 
  CASE 
    WHEN title LIKE '%AI%' THEN 'AI/Tech'
    WHEN title LIKE '%Web%' OR title LIKE '%Development%' THEN 'Web Dev'
    WHEN title LIKE '%Space%' OR title LIKE '%Mars%' THEN 'Space'
    WHEN title LIKE '%Security%' OR title LIKE '%Cyber%' THEN 'Security'
    ELSE 'Other'
  END as category,
  COUNT(*) as count
FROM summaries
GROUP BY category
ORDER BY count DESC;

-- Transcript content analysis
SELECT 
  CASE 
    WHEN transcript_text LIKE '%programming%' THEN 'Programming'
    WHEN transcript_text LIKE '%AI%' OR transcript_text LIKE '%artificial intelligence%' THEN 'AI'
    WHEN transcript_text LIKE '%web%' OR transcript_text LIKE '%JavaScript%' THEN 'Web Dev'
    WHEN transcript_text LIKE '%database%' OR transcript_text LIKE '%SQL%' THEN 'Database'
    ELSE 'Other'
  END as content_type,
  COUNT(*) as count,
  AVG(word_count) as avg_length
FROM transcripts
GROUP BY content_type
ORDER BY count DESC;

-- Database size and stats
SELECT 
  (SELECT COUNT(*) FROM summaries) as summaries,
  (SELECT COUNT(*) FROM transcripts) as transcripts,
  (SELECT COUNT(*) FROM daily_reports) as reports,
  (SELECT COUNT(*) FROM analytics) as analytics,
  (SELECT COUNT(*) FROM video_metadata) as metadata;
```

## 🔍 Maintenance Queries

### Cleanup old data (if needed)
```sql
-- Delete summaries older than 90 days
DELETE FROM summaries 
WHERE created_at < datetime('now', '-90 days');

-- Delete transcripts older than 90 days
DELETE FROM transcripts 
WHERE created_at < datetime('now', '-90 days');

-- Delete old analytics (keep last 30 days)
DELETE FROM analytics 
WHERE created_at < datetime('now', '-30 days');
```

### Backup & Export
```sql
-- Export summaries to CSV (run from command line)
.mode csv
.output summaries_backup.csv
SELECT * FROM summaries;
.quit

-- Export transcripts to CSV
.mode csv
.output transcripts_backup.csv
SELECT video_id, word_count, language, source, created_at FROM transcripts;
.quit
```

## 🚀 Quick Database Health Check
```sql
SELECT 
  'Database Health Check' as check_type,
  (SELECT COUNT(*) FROM summaries) as total_summaries,
  (SELECT COUNT(*) FROM transcripts) as total_transcripts,
  (SELECT COUNT(*) FROM daily_reports) as total_reports,
  (SELECT MAX(created_at) FROM summaries) as latest_summary,
  (SELECT MAX(created_at) FROM transcripts) as latest_transcript,
  (SELECT MAX(created_at) FROM daily_reports) as latest_report;
```

## 💡 Pro Tips
- **Full-text search**: Use `LIKE '%term%'` for case-insensitive searching
- **Performance**: Indexes are created automatically for video_id and created_at
- **Storage**: SQLite automatically compresses text data
- **Backup**: Copy the entire `bot.db` file to backup everything
- **Size monitoring**: Run `.dbinfo` to see detailed database statistics