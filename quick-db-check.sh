#!/bin/bash

# Quick database check commands for Heroku

echo "🔍 Quick Database Stats"
echo "====================="

# Total counts
heroku run "node -e 'const sqlite3=require(\"sqlite3\").verbose();const db=new sqlite3.Database(\"./data/bot.db\");db.get(\"SELECT COUNT(*) as total FROM summaries\",(err,row)=>{console.log(\"📊 Total summaries:\",row.total);db.close();});'" --app yt-discord-automation

# Today's count
heroku run "node -e 'const sqlite3=require(\"sqlite3\").verbose();const db=new sqlite3.Database(\"./data/bot.db\");const today=\"2025-10-10\";db.get(\"SELECT COUNT(*) as count FROM summaries WHERE DATE(created_at)=?\", [today],(err,row)=>{console.log(\"📅 Today:\",row.count,\"new summaries\");db.close();});'" --app yt-discord-automation

# Most recent
heroku run "node -e 'const sqlite3=require(\"sqlite3\").verbose();const db=new sqlite3.Database(\"./data/bot.db\");db.get(\"SELECT video_id,title,created_at FROM summaries ORDER BY created_at DESC LIMIT 1\",(err,row)=>{if(row)console.log(\"🕐 Latest:\",row.video_id,\"-\",row.title.substring(0,50)+\"...\",\"(\"+row.created_at+\")\");else console.log(\"No summaries found\");db.close();});'" --app yt-discord-automation