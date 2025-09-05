#!/bin/bash

echo "📝 Food Waste Tracker Logs"
echo "=========================="

# Show container status
echo "📊 Container Status:"
docker compose ps
echo ""

# Show logs with follow
echo "📝 Live Logs (Ctrl+C to exit):"
docker compose logs -f