#!/bin/bash

echo "======================================"
echo " LPanel - Linux Server Management Panel"
echo "          Installation Script"
echo "======================================"

generate_random_string() {
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1
}

generate_random_port() {
  echo $((RANDOM % 5000 + 8000))
}

ADMIN_USERNAME="admin"
ADMIN_PASSWORD=$(generate_random_string)
JWT_SECRET=$(generate_random_string)
DB_PASSWORD=$(generate_random_string)
FRONTEND_PORT=$(generate_random_port)

echo ""
echo "Step 1: Updating system packages..."
sudo apt update && sudo apt upgrade -y

echo ""
echo "Step 2: Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo ""
echo "Step 3: Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

echo ""
echo "Step 4: Creating database and user..."
sudo -u postgres psql -c "CREATE DATABASE lpanel;"
sudo -u postgres psql -c "CREATE USER lpanel WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lpanel TO lpanel;"

echo ""
echo "Step 5: Installing Nginx..."
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

echo ""
echo "Step 6: Installing project dependencies..."
cd server
npm install
cd ..
cd web
npm install
cd ..

echo ""
echo "Step 7: Configuring environment..."
cd server
cp .env.example .env
sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://lpanel:$DB_PASSWORD@localhost:5432/lpanel\"|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET\"|" .env
cd ..

echo ""
echo "Step 8: Running database migrations..."
cd server
npx prisma migrate dev --name init
npx prisma generate
cd ..

echo ""
echo "Step 9: Creating admin user..."
cd server
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createAdmin() {
  const passwordHash = await bcrypt.hash('$ADMIN_PASSWORD', 10);
  await prisma.user.create({
    data: {
      username: '$ADMIN_USERNAME',
      email: 'admin@localhost',
      password_hash: passwordHash,
      role: 'admin',
      status: true
    }
  });
  console.log('Admin user created successfully');
}

createAdmin().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
"
cd ..

echo ""
echo "Step 10: Building frontend..."
cd web
npm run build
cd ..

echo ""
echo "======================================"
echo " Installation completed successfully!"
echo "======================================"
echo ""
echo "Panel credentials:"
echo "  Username: $ADMIN_USERNAME"
echo "  Password: $ADMIN_PASSWORD"
echo ""
echo "Access URLs:"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend API: http://localhost:3000"
echo ""
echo "Important files:"
echo "  Environment config: server/.env"
echo "  Database password: $DB_PASSWORD"
echo "  JWT secret: $JWT_SECRET"
echo ""
echo "To start the panel, run:"
echo "  cd server && npm run start"