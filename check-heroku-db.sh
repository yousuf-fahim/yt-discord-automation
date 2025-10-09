#!/bin/bash

# Script to check Heroku database contents
echo "🔍 CHECKING HEROKU DATABASE CONTENTS"
echo "=" 50

echo ""
echo "📊 SUMMARY COUNTS:"
heroku run node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/bot.db');
db.get('SELECT COUNT(*) as total FROM summaries', [], (err, row) => {
  if (err) console.error('Error:', err);
  else console.log('Total summaries:', row.total);
  db.close();
});
" --app yt-discord-automation

echo ""
echo "📊 RECENT SUMMARIES (Last 5):"
heroku run node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/bot.db');
db.all('SELECT video_id, title, created_at FROM summaries ORDER BY created_at DESC LIMIT 5', [], (err, rows) => {
  if (err) console.error('Error:', err);
  else {
    console.log('Recent summaries:');
    rows.forEach(row => console.log(\`- \${row.video_id}: \${row.title} (\${row.created_at})\`));
  }
  db.close();
});
" --app yt-discord-automation

echo ""
echo "📊 TODAY'S SUMMARIES:"
heroku run node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/bot.db');
const today = new Date().toISOString().split('T')[0];
db.all('SELECT COUNT(*) as count FROM summaries WHERE DATE(created_at) = ?', [today], (err, rows) => {
  if (err) console.error('Error:', err);
  else console.log('Today (' + today + '):', rows[0].count, 'new summaries');
  db.close();
});
" --app yt-discord-automation