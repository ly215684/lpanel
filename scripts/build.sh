#!/bin/bash

echo "======================================"
echo " LPanel - Building for Production"
echo "======================================"

echo ""
echo "Step 1: Building backend..."
cd server
npm run build
cd ..

echo ""
echo "Step 2: Building frontend..."
cd web
npm run build
cd ..

echo ""
echo "Step 3: Copying frontend assets to server..."
rm -rf server/public
cp -r web/dist server/public

echo ""
echo "======================================"
echo " Build completed successfully!"
echo "======================================"
echo ""
echo "Production files are ready in server/public/"
echo "To start production server, run:"
echo "  cd server && npm run start"