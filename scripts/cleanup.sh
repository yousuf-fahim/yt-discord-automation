#!/bin/bash

# Quick Cleanup Script for YT Discord Bot
# This script reorganizes the project structure for better maintainability

echo "🧹 Starting project cleanup and reorganization..."

# Create new directory structure
echo "📁 Creating new directory structure..."
mkdir -p {tests/{unit,integration,e2e},scripts,docs,config}

# Move test files to tests directory
echo "🔬 Moving test files..."
mv test-*.js tests/unit/ 2>/dev/null || echo "No test files to move"

# Move utility scripts
echo "📜 Moving utility scripts..."
mv dedupe-test.js scripts/ 2>/dev/null
mv temp-transcript.js scripts/ 2>/dev/null
mv setup-oracle-cloud.sh scripts/ 2>/dev/null

# Move documentation files
echo "📚 Moving documentation..."
mv *.md docs/ 2>/dev/null
cp docs/README.md . 2>/dev/null  # Keep README in root

# Move deployment configs
echo "🚀 Organizing deployment configs..."
mkdir -p deployments/{heroku,oracle,vercel}
mv Procfile deployments/heroku/ 2>/dev/null
mv vercel.json deployments/vercel/ 2>/dev/null
mv discord-bot.service deployments/heroku/ 2>/dev/null
mv Aptfile deployments/heroku/ 2>/dev/null
mv requirements.txt deployments/heroku/ 2>/dev/null
mv runtime.txt deployments/heroku/ 2>/dev/null

# Move Python files
echo "🐍 Moving Python files..."
mkdir -p scripts/python
mv *.py scripts/python/ 2>/dev/null

# Clean up temp files
echo "🗑️  Cleaning temporary files..."
rm -rf temp/youtube-sts/ 2>/dev/null
find . -name "*.log" -delete 2>/dev/null
find . -name "*.tmp" -delete 2>/dev/null

# Create environment template if not exists
echo "⚙️  Creating environment template..."
if [ ! -f .env.template ]; then
cat > .env.template << 'EOF'
# Discord Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here
DISCORD_YT_UPLOADS_CHANNEL=yt-uploads
DISCORD_YT_SUMMARIES_CHANNEL=yt-summaries-general
DISCORD_DAILY_REPORT_CHANNEL=daily-report

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo

# YouTube Configuration (Optional)
YOUTUBE_API_KEY=your_youtube_api_key_here

# Environment Settings
NODE_ENV=development
DEBUG_MODE=false
PORT=3000

# Timezone for daily reports
TIMEZONE=Europe/Berlin

# Cache Settings
CACHE_TTL=3600
MAX_CACHE_SIZE_MB=100
EOF
fi

echo "✅ Cleanup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Run 'npm install' to ensure dependencies are up to date"
echo "2. Copy .env.template to .env and fill in your API keys"
echo "3. Run 'npm test' to verify everything still works"
echo "4. Consider implementing the full refactor plan in REFACTOR_PLAN.md"
echo ""
echo "📊 Project structure improved:"
echo "- Test files organized in tests/ directory"
echo "- Documentation moved to docs/ directory" 
echo "- Scripts organized in scripts/ directory"
echo "- Deployment configs in deployments/ directory"
echo "- Temporary files cleaned up"
