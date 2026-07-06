#!/bin/bash

echo "======================================"
echo " LPanel - Uninstallation Script"
echo "======================================"

read -p "Are you sure you want to uninstall LPanel? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

echo ""
echo "Step 1: Stopping services..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "node dist/app.js" 2>/dev/null || true

echo ""
echo "Step 2: Removing database..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS lpanel;"
sudo -u postgres psql -c "DROP USER IF EXISTS lpanel;"

echo ""
echo "Step 3: Removing project files..."
rm -rf node_modules 2>/dev/null || true
rm -rf server/node_modules 2>/dev/null || true
rm -rf web/node_modules 2>/dev/null || true
rm -rf web/dist 2>/dev/null || true
rm -rf server/dist 2>/dev/null || true
rm -rf server/public 2>/dev/null || true

echo ""
echo "Step 4: Removing environment file..."
rm -f server/.env 2>/dev/null || true

echo ""
echo "======================================"
echo " Uninstallation completed!"
echo "======================================"
echo ""
echo "Note: System packages (Node.js, PostgreSQL, Docker, Nginx)"
echo "were NOT removed. To remove them, run:"
echo "  sudo apt remove -y nodejs postgresql docker-ce nginx"