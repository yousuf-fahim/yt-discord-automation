#!/bin/bash

# Advanced Cleanup - Remove API and Utils folders (with selective preservation)
# Run this after the initial cleanup

echo "🧹 Advanced cleanup - API and Utils analysis..."
echo "=============================================="

echo "📊 Current size:"
du -sh .

echo ""
echo "🔍 Analyzing dependencies..."

# Check what's actually being used from utils
echo "📁 Utils folder analysis:"
ls -la utils/

echo ""
echo "📁 API folder analysis:" 
ls -la api/

echo ""
echo "🧹 Removing unnecessary API files..."

# Keep only essential API files (fallback transcript)
if [ -d "api" ]; then
    cd api/
    
    # Remove most API files but keep transcript.js as fallback
    for file in *.js; do
        if [ "$file" != "transcript.js" ]; then
            echo "   ❌ Removing api/$file"
            rm "$file"
        else
            echo "   ✅ Keeping api/$file (fallback)"
        fi
    done
    
    cd ..
fi

echo ""
echo "🧹 Cleaning utils folder..."

if [ -d "utils" ]; then
    cd utils/
    
    # Keep only youtube-title.js (used by Discord service)
    for file in *.js; do
        if [ "$file" != "youtube-title.js" ]; then
            echo "   ❌ Removing utils/$file"
            rm "$file"
        else
            echo "   ✅ Keeping utils/$file (used by Discord service)"
        fi
    done
    
    cd ..
fi

echo ""
echo "📊 Size after advanced cleanup:"
du -sh .

echo ""
echo "📁 Remaining essential files:"
echo "   📁 src/ - Main ServiceManager architecture"
echo "   📁 api/transcript.js - Fallback transcript method"
echo "   📁 utils/youtube-title.js - Title scraping utility"
echo "   📁 node_modules/ - Dependencies"
echo "   📁 prompts/ - AI prompts"
echo "   📁 cache/ - Runtime cache"

echo ""
echo "✅ Advanced cleanup complete!"
echo "🎯 Estimated final size: ~44-45M (minimal production build)"
