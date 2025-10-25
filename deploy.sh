#!/bin/bash

echo "🚀 Deploying Food Waste Tracker with Docker..."

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found. Please run from project root directory."
    exit 1
fi

# Check required directories exist
if [ ! -d "src" ] || [ ! -d "public" ] || [ ! -d "server" ]; then
    echo "❌ Required directories (src, public, server) not found."
    echo "   Current directory: $(pwd)"
    echo "   Contents: $(ls -la)"
    exit 1
fi

# Check if service account file exists
if [ ! -f "server/google-service-account.json" ]; then
    echo "⚠️  Warning: Google service account file not found at server/google-service-account.json"
    echo "   Vision API will use service account fallback"
fi

# Check if API keys are configured
if ! grep -q "GOOGLE_GEMINI_API_KEY=" .env.production || grep -q "your_gemini_api_key_here" .env.production; then
    echo "⚠️  Warning: GOOGLE_GEMINI_API_KEY not configured in .env.production"
    echo "   Add your Gemini API key to .env.production for receipt parsing"
fi

if ! grep -q "REACT_APP_GOOGLE_VISION_API_KEY=" .env.production || grep -q "your_vision_api_key_here" .env.production; then
    echo "⚠️  Warning: REACT_APP_GOOGLE_VISION_API_KEY not configured in .env.production"
    echo "   Add your Vision API key to .env.production for barcode scanning"
fi

# Create data directory for database persistence
mkdir -p data

# Build and start containers
echo "🏗️  Building containers..."
docker compose build

echo "🚀 Starting services..."
docker compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check container status
echo "📊 Container status:"
docker compose ps

# Show logs
echo "📝 Recent logs:"
docker compose logs --tail=20

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your app:"
echo "   Production: https://nohaste.dev.tk.sg"
echo "   Local: http://localhost"
echo "   Backend API: http://localhost:3002"
echo ""
echo "📊 Useful commands:"
echo "   View logs:    docker compose logs -f"
echo "   Stop app:     docker compose down"
echo "   Restart:      docker compose restart"
echo "   Status:       docker compose ps"