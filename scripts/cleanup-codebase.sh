#!/bin/bash

# 🧹 Comprehensive Codebase Cleanup Script
# This script removes old/unused code and organizes the project for deployment

echo "🧹 Starting comprehensive codebase cleanup..."
echo "This will organize your project and remove old/unused files."
echo ""

# Create backup before cleanup
echo "📦 Creating backup..."
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r . "$BACKUP_DIR/" 2>/dev/null || echo "Backup created with some skipped files"

# Create proper directory structure
echo "📁 Creating organized directory structure..."
mkdir -p {tests/unit,tests/integration,docs,scripts,archive}

echo ""
echo "🗑️  REMOVING OLD/UNUSED FILES:"

# 1. Remove old Python file (we have the new transcript service)
if [ -f "old_file.py" ]; then
    echo "   ❌ Removing old_file.py (2,000+ lines of old Python code)"
    mv old_file.py archive/
fi

# 2. Remove backup files
if [ -f "api/transcript.js.bak" ]; then
    echo "   ❌ Removing transcript.js.bak (backup file)"
    rm -f api/transcript.js.bak
fi

# 3. Remove scattered test files from root (move to tests/)
echo "   📦 Moving scattered test files to tests/unit/:"
test_files_moved=0
for file in test-*.js; do
    if [ -f "$file" ]; then
        echo "      • $file → tests/unit/"
        mv "$file" tests/unit/
        ((test_files_moved++))
    fi
done
echo "   ✅ Moved $test_files_moved test files"

# 4. Remove old complex transcript service (we have the new simple one)
if [ -f "src/services/robust-transcript.service.js" ]; then
    echo "   ❌ Removing robust-transcript.service.js (complex, replaced with simple free API)"
    mv src/services/robust-transcript.service.js archive/
fi

# 5. Clean up temp directories
echo "   🧽 Cleaning temp directories:"
if [ -d "temp/9bZkp7q19f0" ]; then
    echo "      • temp/9bZkp7q19f0/"
    rm -rf temp/9bZkp7q19f0/
fi

if [ -d "temp/x0tgdtpjnpc" ]; then
    echo "      • temp/x0tgdtpjnpc/"
    rm -rf temp/x0tgdtpjnpc/
fi

if [ -d "temp/youtube-sts" ]; then
    echo "      • temp/youtube-sts/"
    rm -rf temp/youtube-sts/
fi

# 6. Remove duplicate files and old logs
echo "   🧹 Removing duplicate and old files:"
if [ -f "temp-transcript.js" ]; then
    echo "      • temp-transcript.js"
    rm -f temp-transcript.js
fi

if [ -f "dedupe-test.js" ]; then
    echo "      • dedupe-test.js"
    mv dedupe-test.js scripts/
fi

# 7. Remove old documentation that's been reorganized
echo "   📚 Organizing documentation:"
doc_files_moved=0
for file in *.md; do
    if [ -f "$file" ] && [ "$file" != "README.md" ]; then
        echo "      • $file → docs/"
        mv "$file" docs/
        ((doc_files_moved++))
    fi
done
echo "   ✅ Moved $doc_files_moved documentation files"

# 8. Remove old subtitle files (samples no longer needed)
echo "   🎬 Removing old subtitle sample files:"
if [ -f "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster) [dQw4w9WgXcQ].en.srt" ]; then
    echo "      • Rick Astley subtitle file"
    rm -f "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster) [dQw4w9WgXcQ].en.srt"
fi

if [ -f "The Anti-Vax Community Is Calling Me Fat... [U-fZ8zpNLa8].en.srt" ]; then
    echo "      • Anti-Vax subtitle file"
    rm -f "The Anti-Vax Community Is Calling Me Fat... [U-fZ8zpNLa8].en.srt"
fi

# 9. Remove old test output files
echo "   📄 Removing old test output files:"
if [ -f "test-cleaned-transcript.txt" ]; then
    echo "      • test-cleaned-transcript.txt"
    rm -f test-cleaned-transcript.txt
fi

if [ -f "test-link-to-summary-results.txt" ]; then
    echo "      • test-link-to-summary-results.txt"
    rm -f test-link-to-summary-results.txt
fi

if [ -f "test-transcript-output.txt" ]; then
    echo "      • test-transcript-output.txt"
    rm -f test-transcript-output.txt
fi

# 10. Remove complex/unused scripts
echo "   🔧 Archiving complex/unused scripts:"
if [ -f "scripts/heroku-transcript-setup.js" ]; then
    echo "      • heroku-transcript-setup.js (replaced with simple Python setup)"
    mv scripts/heroku-transcript-setup.js archive/
fi

# 11. Clean up any Python auth files we don't need
if [ -f "youtube_auth.py" ]; then
    echo "      • youtube_auth.py (not needed with new service)"
    mv youtube_auth.py archive/
fi

echo ""
echo "🎯 KEEPING ESSENTIAL FILES:"
echo "   ✅ src/ - New organized service architecture"
echo "   ✅ api/ - Core Discord bot functionality"
echo "   ✅ utils/ - Utility functions"
echo "   ✅ tests/test-youtube-transcript-api.js - New transcript test"
echo "   ✅ requirements.txt - Updated Python dependencies"
echo "   ✅ package.json - Updated Node.js scripts"

echo ""
echo "📊 CLEANUP SUMMARY:"

# Count remaining files
remaining_files=$(find . -type f -name "*.js" | wc -l)
remaining_tests=$(find tests/ -type f -name "*.js" 2>/dev/null | wc -l)
archived_files=$(find archive/ -type f 2>/dev/null | wc -l)

echo "   📁 Remaining JavaScript files: $remaining_files"
echo "   🧪 Organized test files: $remaining_tests"
echo "   📦 Archived old files: $archived_files"
echo "   🗂️  Backup created in: $BACKUP_DIR"

echo ""
echo "🚀 PROJECT IS NOW CLEAN AND READY FOR:"
echo "   • Local testing with: npm run test:transcript:api"
echo "   • Development with: npm run dev:new"
echo "   • Heroku deployment"

echo ""
echo "✨ Your codebase is now:"
echo "   ✅ Organized (tests in tests/, docs in docs/)"
echo "   ✅ Simplified (old complex code archived)"
echo "   ✅ Efficient (using free YouTube Transcript API)"
echo "   ✅ Deploy-ready (Heroku-optimized)"

echo ""
echo "💡 Next steps:"
echo "   1. Test locally: npm run test:transcript:api"
echo "   2. Run dev server: npm run dev:new"
echo "   3. Deploy to Heroku when ready"

echo ""
echo "🎉 Cleanup complete! Your project is now clean and efficient."
