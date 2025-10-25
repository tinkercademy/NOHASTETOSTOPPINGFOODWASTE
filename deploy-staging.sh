#!/bin/bash

echo "🧪 Deploying Food Waste Tracker to STAGING (Local Docker)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "docker-compose.staging.yml" ]; then
    print_error "docker-compose.staging.yml not found. Please run from project root directory."
    exit 1
fi

# Check required directories exist
if [ ! -d "src" ] || [ ! -d "public" ] || [ ! -d "server" ]; then
    print_error "Required directories (src, public, server) not found."
    print_status "Current directory: $(pwd)"
    print_status "Contents: $(ls -la)"
    exit 1
fi

# Check if service account file exists
if [ ! -f "server/google-service-account.json" ]; then
    print_warning "Google service account file not found at server/google-service-account.json"
    print_status "Vision API will use API key fallback"
fi

# Check if API keys are configured in staging environment
if ! grep -q "GOOGLE_GEMINI_API_KEY=" .env.staging || grep -q "your_gemini_api_key_here" .env.staging; then
    print_warning "GOOGLE_GEMINI_API_KEY not configured in .env.staging"
    print_status "Receipt parsing may not work without Gemini API key"
fi

if ! grep -q "REACT_APP_GOOGLE_VISION_API_KEY=" .env.staging || grep -q "your_vision_api_key_here" .env.staging; then
    print_warning "REACT_APP_GOOGLE_VISION_API_KEY not configured in .env.staging"
    print_status "Vision API may not work without API key"
fi

# Stop any existing staging containers
print_status "Stopping existing staging containers..."
docker compose -f docker-compose.staging.yml down 2>/dev/null || true

# Create data directory for database persistence
print_status "Creating staging data directory..."
mkdir -p data-staging

# Clean up any old images (optional)
print_status "Cleaning up old staging images..."
docker compose -f docker-compose.staging.yml down --rmi all --remove-orphans 2>/dev/null || true

# Build containers
print_status "Building staging containers..."
docker compose -f docker-compose.staging.yml build

if [ $? -ne 0 ]; then
    print_error "Failed to build containers"
    exit 1
fi

# Start services
print_status "Starting staging services..."
docker compose -f docker-compose.staging.yml up -d

if [ $? -ne 0 ]; then
    print_error "Failed to start services"
    exit 1
fi

# Wait for services to start
print_status "Waiting for services to start..."
sleep 15

# Check container status
print_status "Container status:"
docker compose -f docker-compose.staging.yml ps

# Wait for backend to be healthy
print_status "Waiting for backend to be healthy..."
timeout 60 bash -c 'until docker compose -f docker-compose.staging.yml exec -T backend wget --no-verbose --tries=1 --spider http://localhost:3002/api/categories; do sleep 2; done'

if [ $? -eq 0 ]; then
    print_success "Backend is healthy!"
else
    print_warning "Backend health check timed out, but continuing..."
fi

# Show logs
print_status "Recent backend logs:"
docker compose -f docker-compose.staging.yml logs --tail=10 backend

print_status "Recent frontend logs:"
docker compose -f docker-compose.staging.yml logs --tail=10 frontend

echo ""
print_success "Staging deployment complete!"
echo ""
echo "🌐 Access your staging app:"
echo "   Frontend: http://localhost:3001"
echo "   Backend API: http://localhost:3002"
echo "   API Health: http://localhost:3002/api/categories"
echo ""
echo "📊 Useful staging commands:"
echo "   View logs:    docker compose -f docker-compose.staging.yml logs -f"
echo "   Stop app:     docker compose -f docker-compose.staging.yml down"
echo "   Restart:      docker compose -f docker-compose.staging.yml restart"
echo "   Status:       docker compose -f docker-compose.staging.yml ps"
echo "   Shell access: docker compose -f docker-compose.staging.yml exec backend sh"
echo ""
echo "🧪 Testing Vision AI:"
echo "   - Test barcode scanning at http://localhost:3001"
echo "   - Test receipt parsing with real receipts"
echo "   - Check logs: docker compose -f docker-compose.staging.yml logs -f backend"
echo ""
echo "🔄 To stop staging:"
echo "   docker compose -f docker-compose.staging.yml down"