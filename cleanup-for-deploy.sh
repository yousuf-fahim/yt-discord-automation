#!/bin/bash

# Pre-Deployment Cleanup Script
# Removes unnecessary files to reduce slug size for Heroku

echo "🧹 Starting pre-deployment cleanup..."
echo "======================================"

# Check initial size
echo "📊 Initial size:"
du -sh .

echo ""
echo "🗑️  Removing large unnecessary directories..."

# Remove backup directory (68M)
if [ -d "backup-20250901-141703" ]; then
    echo "   ❌ Removing backup-20250901-141703/ (68M)"
    rm -rf backup-20250901-141703/
fi

# Remove archive directory (132K)
if [ -d "archive" ]; then
    echo "   ❌ Removing archive/ (132K)" 
    rm -rf archive/
fi

# Remove tests directory (80K)
if [ -d "tests" ]; then
    echo "   ❌ Removing tests/ (80K)"
    rm -rf tests/
fi

# Remove docs directory (64K) 
if [ -d "docs" ]; then
    echo "   ❌ Removing docs/ (64K)"
    rm -rf docs/
fi

echo ""
echo "🗑️  Removing test files..."

# Remove test files
for file in test-*.js; do
    if [ -f "$file" ]; then
        echo "   ❌ Removing $file"
        rm "$file"
    fi
done

# Remove manual test files
for file in manual-*.js; do
    if [ -f "$file" ]; then
        echo "   ❌ Removing $file"
        rm "$file"
    fi
done

# Remove other test files
if [ -f "quick-report-test.js" ]; then
    echo "   ❌ Removing quick-report-test.js"
    rm quick-report-test.js
fi

echo ""
echo "🗑️  Removing development files..."

# Remove temp directory if exists
if [ -d "temp" ]; then
    echo "   ❌ Removing temp/"
    rm -rf temp/
fi

# Remove Python virtual environment
if [ -d ".venv" ]; then
    echo "   ❌ Removing .venv/"
    rm -rf .venv/
fi

# Remove cursor config
if [ -d ".cursor" ]; then
    echo "   ❌ Removing .cursor/"
    rm -rf .cursor/
fi

# Remove development scripts
if [ -f "setup-oracle-cloud.sh" ]; then
    echo "   ❌ Removing setup-oracle-cloud.sh"
    rm setup-oracle-cloud.sh
fi

if [ -f "discord-bot.service" ]; then
    echo "   ❌ Removing discord-bot.service"
    rm discord-bot.service
fi

# Remove .python-version
if [ -f ".python-version" ]; then
    echo "   ❌ Removing .python-version"
    rm .python-version
fi

# Remove requirements.txt (not needed for Node.js app)
if [ -f "requirements.txt" ]; then
    echo "   ❌ Removing requirements.txt"
    rm requirements.txt
fi

# Remove runtime.txt (Python specific)
if [ -f "runtime.txt" ]; then
    echo "   ❌ Removing runtime.txt"
    rm runtime.txt
fi

echo ""
echo "🧹 Cleaning cache directory..."

# Keep cache directory but remove old files
if [ -d "cache" ]; then
    echo "   🗑️  Cleaning old cache files..."
    find cache/ -name "*.txt" -mtime +7 -delete 2>/dev/null || true
    find cache/ -name "*.json" -mtime +7 -delete 2>/dev/null || true
fi

echo ""
echo "📊 Final size:"
du -sh .

echo ""
echo "📁 File count:"
find . -type f | wc -l

echo ""
echo "✅ Cleanup complete! Ready for Heroku deployment."
echo "🚀 You can now run: git add . && git commit -m 'Clean build for deployment' && git push heroku main"
