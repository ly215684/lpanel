#!/bin/bash

echo "======================================"
echo " LPanel - Starting Services"
echo "======================================"

echo ""
echo "Starting backend server..."
cd server
npm run dev &
SERVER_PID=$!
echo "Backend server started with PID: $SERVER_PID"

echo ""
echo "Starting frontend development server..."
cd ../web
npm run dev &
WEB_PID=$!
echo "Frontend server started with PID: $WEB_PID"

echo ""
echo "======================================"
echo " Services started successfully!"
echo "======================================"
echo ""
echo "Backend API: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "To stop services, run:"
echo "  kill $SERVER_PID $WEB_PID"

wait