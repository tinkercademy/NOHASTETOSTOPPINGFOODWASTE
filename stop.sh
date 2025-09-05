#!/bin/bash

echo "🛑 Stopping Food Waste Tracker..."

# Stop and remove containers
docker compose down

echo "📊 Final container status:"
docker compose ps

echo "✅ All services stopped."