#!/bin/bash

# SQLite Database Explorer for YouTube Discord Bot
echo "🗄️ YouTube Discord Bot - Database Explorer"
echo "============================================"
echo ""
echo "📍 Database Location: $(pwd)/data/bot.db"
echo "📊 Database Size: $(ls -lh data/bot.db | awk '{print $5}')"
echo ""

# Quick stats
echo "📈 Quick Statistics:"
sqlite3 data/bot.db -header -column "
SELECT 
  (SELECT COUNT(*) FROM summaries) as 'Total Summaries',
  (SELECT COUNT(*) FROM daily_reports) as 'Daily Reports',
  (SELECT COUNT(*) FROM analytics) as 'Analytics Entries',
  (SELECT COUNT(*) FROM video_metadata) as 'Video Metadata';"

echo ""
echo "🕒 Recent Activity (Last 5 summaries):"
sqlite3 data/bot.db -header -column "
SELECT 
  video_id as 'Video ID',
  substr(title, 1, 40) || '...' as 'Title',
  created_at as 'Created'
FROM summaries 
ORDER BY created_at DESC 
LIMIT 5;"

echo ""
echo "📋 Available Commands:"
echo "  .tables              - List all tables"
echo "  .schema [table]      - Show table structure"
echo "  .quit               - Exit SQLite"
echo ""
echo "🚀 Common Queries:"
echo "  SELECT * FROM summaries WHERE title LIKE '%AI%';"
echo "  SELECT date, summary_count FROM daily_reports;"
echo "  SELECT * FROM analytics ORDER BY date DESC;"
echo ""
echo "💡 Starting interactive SQLite session..."
echo "   Type .quit to exit"
echo ""

# Start interactive SQLite session
sqlite3 data/bot.db