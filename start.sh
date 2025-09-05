#!/bin/bash

echo "Starting No Haste Food Waste Tracker..."

# Check if .env file exists and load it
if [ -f .env ]; then
    echo "Loading environment variables from .env..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Warning: .env file not found. Create one from .env.example if needed."
fi

# Start backend server
echo "Starting backend server..."
cd server
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend..."
cd ..
npm start &
FRONTEND_PID=$!

echo "Backend running on http://localhost:3002"
echo "Frontend running on http://localhost:3000"
echo "Press Ctrl+C to stop both servers"

# Wait for user to interrupt
trap 'echo "Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID; exit' INT
wait