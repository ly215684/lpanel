#!/bin/bash

set -e

REPO="ly215684/lpanel"
INSTALL_DIR="/opt/lpanel"
DOWNLOAD_DIR="/tmp/lpanel-install"

generate_random_string() {
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1
}

generate_random_port() {
  echo $((RANDOM % 5000 + 8000))
}

echo "======================================"
echo "  LPanel - 一键安装脚本"
echo "======================================"
echo ""

echo "[1/8] 检测系统环境..."
if ! command -v curl &> /dev/null; then
  echo "安装 curl..."
  sudo apt update && sudo apt install -y curl
fi

if ! command -v jq &> /dev/null; then
  echo "安装 jq..."
  sudo apt install -y jq
fi

echo "[2/8] 获取最新版本..."
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
VERSION=$(echo "$LATEST_RELEASE" | jq -r '.tag_name')
DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | jq -r '.assets[] | select(.name | test("\\.zip$")) | .browser_download_url')

if [ -z "$DOWNLOAD_URL" ]; then
  echo "错误：未找到最新版本的下载链接"
  exit 1
fi

echo "  最新版本: $VERSION"
echo "  下载地址: $DOWNLOAD_URL"

echo ""
echo "[3/8] 下载安装包..."
mkdir -p "$DOWNLOAD_DIR"
curl -L -o "$DOWNLOAD_DIR/lpanel.zip" "$DOWNLOAD_URL"

echo ""
echo "[4/8] 解压安装包..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
unzip -q "$DOWNLOAD_DIR/lpanel.zip" -d "$INSTALL_DIR"

echo ""
echo "[5/8] 安装系统依赖..."

echo "  安装 Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "  安装 PostgreSQL..."
if ! command -v psql &> /dev/null; then
  sudo apt install -y postgresql postgresql-contrib
  sudo systemctl enable postgresql
  sudo systemctl start postgresql
fi

echo "  安装 Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o "$DOWNLOAD_DIR/get-docker.sh"
  sudo sh "$DOWNLOAD_DIR/get-docker.sh"
  sudo usermod -aG docker $USER
fi

echo "  安装 Nginx..."
if ! command -v nginx &> /dev/null; then
  sudo apt install -y nginx
  sudo systemctl enable nginx
  sudo systemctl start nginx
fi

echo ""
echo "[6/8] 配置数据库..."
DB_PASSWORD=$(generate_random_string)
JWT_SECRET=$(generate_random_string)
ADMIN_PASSWORD=$(generate_random_string)

sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='lpanel'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE lpanel;"

sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='lpanel'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER lpanel WITH PASSWORD '$DB_PASSWORD';"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lpanel TO lpanel;"

echo ""
echo "[7/8] 配置环境变量..."
cd "$INSTALL_DIR/lpanel/server"

cat > .env << EOF
PORT=3000
HOST=0.0.0.0

DATABASE_URL="postgresql://lpanel:$DB_PASSWORD@localhost:5432/lpanel?schema=public"

JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

ADMIN_PASSWORD="$ADMIN_PASSWORD"

LOG_LEVEL="info"
EOF

echo ""
echo "[8/8] 初始化面板..."

echo "  运行数据库迁移..."
npx prisma migrate dev --name init --skip-seed

echo "  创建管理员用户..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createAdmin() {
  const passwordHash = await bcrypt.hash('$ADMIN_PASSWORD', 10);
  await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@localhost',
      password_hash: passwordHash,
      role: 'admin',
      status: true
    }
  });
  console.log('Admin user created');
}

createAdmin().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
"

echo ""
echo "======================================"
echo "   安装完成！"
echo "======================================"
echo ""
echo "访问地址: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "登录凭据:"
echo "  用户名: admin"
echo "  密码: $ADMIN_PASSWORD"
echo ""
echo "启动命令:"
echo "  cd $INSTALL_DIR/lpanel/server"
echo "  npm run start"
echo ""
echo "配置文件: $INSTALL_DIR/lpanel/server/.env"
echo ""

rm -rf "$DOWNLOAD_DIR"