#!/bin/bash

echo "Starting No Haste Food Waste Tracker..."

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

echo "Backend running on http://localhost:3001"
echo "Frontend running on http://localhost:3000"
echo "Press Ctrl+C to stop both servers"

# Wait for user to interrupt
trap 'echo "Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID; exit' INT
wait