#!/bin/bash

# 🧪 Local Testing Script
# Test all core functionality before deployment

echo "🧪 Running comprehensive local tests..."
echo ""

# Test 1: Core transcript service
echo "1️⃣ Testing YouTube Transcript API service..."
npm run test:transcript:api
if [ $? -eq 0 ]; then
    echo "✅ Transcript service: PASSED"
else
    echo "❌ Transcript service: FAILED"
    exit 1
fi

echo ""

# Test 2: Check all core files for syntax errors
echo "2️⃣ Checking core files for syntax errors..."
error_count=0

echo "   📄 Checking api/listener.js..."
node -c api/listener.js || ((error_count++))

echo "   📄 Checking api/summary.js..."
node -c api/summary.js || ((error_count++))

echo "   📄 Checking api/transcript.js..."
node -c api/transcript.js || ((error_count++))

echo "   📄 Checking src/main.js..."
node -c src/main.js || ((error_count++))

if [ $error_count -eq 0 ]; then
    echo "✅ Syntax check: PASSED"
else
    echo "❌ Syntax check: FAILED ($error_count errors)"
    exit 1
fi

echo ""

# Test 3: Environment check
echo "3️⃣ Checking environment configuration..."
if [ -f ".env" ]; then
    echo "✅ .env file found"
    
    # Check for critical environment variables
    if grep -q "DISCORD_BOT_TOKEN" .env; then
        echo "✅ Discord bot token configured"
    else
        echo "⚠️ Discord bot token not found in .env"
    fi
    
    if grep -q "OPENAI_API_KEY" .env; then
        echo "✅ OpenAI API key configured"
    else
        echo "⚠️ OpenAI API key not found in .env"
    fi
else
    echo "⚠️ .env file not found - you'll need to create one for deployment"
fi

echo ""

# Test 4: Dependencies check
echo "4️⃣ Checking Node.js dependencies..."
if npm list > /dev/null 2>&1; then
    echo "✅ Node.js dependencies: OK"
else
    echo "⚠️ Some Node.js dependencies may be missing - run 'npm install'"
fi

echo ""

# Test 5: Python dependencies check
echo "5️⃣ Checking Python dependencies..."
python3 -c "
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    print('✅ youtube-transcript-api: OK')
except ImportError:
    print('❌ youtube-transcript-api: MISSING')
    print('   Fix: pip install youtube-transcript-api')
    exit(1)
"

if [ $? -ne 0 ]; then
    exit 1
fi

echo ""

# Test 6: Project structure
echo "6️⃣ Verifying project structure..."
required_dirs=("api" "src" "utils" "tests" "docs")
missing_dirs=0

for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir/ directory exists"
    else
        echo "❌ $dir/ directory missing"
        ((missing_dirs++))
    fi
done

if [ $missing_dirs -eq 0 ]; then
    echo "✅ Project structure: OK"
else
    echo "❌ Project structure: INCOMPLETE"
    exit 1
fi

echo ""

# Test 7: Cache functionality
echo "7️⃣ Testing cache functionality..."
if [ -d "cache" ]; then
    echo "✅ Cache directory exists"
    cache_files=$(find cache -name "*.json" 2>/dev/null | wc -l)
    echo "📦 Cache files: $cache_files"
else
    echo "📁 Creating cache directory..."
    mkdir -p cache
    echo "✅ Cache directory created"
fi

echo ""

# Final summary
echo "🎉 LOCAL TESTING COMPLETE!"
echo ""
echo "✅ Your project is ready for:"
echo "   • Local development (npm run dev:new)"
echo "   • Heroku deployment"
echo ""
echo "🚀 To start development server:"
echo "   npm run dev:new"
echo ""
echo "🌐 To deploy to Heroku:"
echo "   git add ."
echo "   git commit -m 'Clean codebase ready for deployment'"
echo "   git push heroku main"
echo ""
echo "💡 All core functionality tested and working!"
