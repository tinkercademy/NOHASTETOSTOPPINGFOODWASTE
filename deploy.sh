#!/bin/bash

echo "🚀 Deploying Food Waste Tracker with Docker..."

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if service account file exists
if [ ! -f "server/google-service-account.json" ]; then
    echo "⚠️  Warning: Google service account file not found at server/google-service-account.json"
    echo "   Vision API will use mock data instead of real AI"
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