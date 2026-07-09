#!/bin/bash

set -e

REPO="ly215684/lpanel"
INSTALL_DIR="/opt/lpanel"
DOWNLOAD_DIR="/tmp/lpanel-install"
MAX_RETRIES=10
RETRY_DELAY=5

generate_random_username() {
  local length=$((RANDOM % 2 + 5))
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w "$length" | head -n 1
}

generate_random_password() {
  local length=$((RANDOM % 3 + 8))
  cat /dev/urandom | tr -dc 'a-zA-Z0-9!@#$%^&*_+-=' | fold -w "$length" | head -n 1
}

generate_random_port() {
  echo $((RANDOM % 5000 + 8000))
}

open_firewall_port() {
  local port=$1
  
  if command -v ufw &> /dev/null; then
    echo "  配置 UFW 防火墙..."
    sudo ufw allow $port/tcp
    sudo ufw reload
  elif command -v firewalld &> /dev/null; then
    echo "  配置 firewalld 防火墙..."
    sudo firewall-cmd --permanent --add-port=$port/tcp
    sudo firewall-cmd --reload
  else
    echo "  未检测到防火墙，跳过端口开放"
  fi
}

get_public_ip() {
  local public_ip=""
  
  public_ip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || true)
  if [ -n "$public_ip" ] && echo "$public_ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "$public_ip"
    return 0
  fi
  
  public_ip=$(curl -s --max-time 5 https://ifconfig.me/ip 2>/dev/null || true)
  if [ -n "$public_ip" ] && echo "$public_ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "$public_ip"
    return 0
  fi
  
  public_ip=$(curl -s --max-time 5 https://icanhazip.com 2>/dev/null || true)
  if [ -n "$public_ip" ] && echo "$public_ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "$public_ip"
    return 0
  fi
  
  return 1
}

get_lan_ip() {
  local lan_ip=""
  
  lan_ip=$(hostname -I | awk '{print $1}')
  if [ -n "$lan_ip" ] && echo "$lan_ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "$lan_ip"
    return 0
  fi
  
  lan_ip=$(ip -o -4 addr show | grep -v '127.0.0.1' | head -n 1 | awk '{print $4}' | cut -d'/' -f1)
  if [ -n "$lan_ip" ] && echo "$lan_ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "$lan_ip"
    return 0
  fi
  
  echo "127.0.0.1"
  return 0
}

get_access_ip() {
  local public_ip=$(get_public_ip)
  if [ -n "$public_ip" ]; then
    echo "$public_ip"
    return 0
  fi
  
  get_lan_ip
}

download_with_retry() {
  local url=$1
  local output=$2
  local attempt=1

  while [ $attempt -le $MAX_RETRIES ]; do
    echo "  尝试下载 ($attempt/$MAX_RETRIES)..."
    
    local http_code
    http_code=$(curl -L --connect-timeout 30 --max-time 600 --retry 3 --retry-delay 3 --retry-max-time 60 -w "%{http_code}" -o "$output" "$url" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
      echo "  下载成功！"
      return 0
    fi
    
    if [ "$http_code" = "429" ]; then
      echo "  限速 (429)，等待 10 秒后重试..."
      sleep 10
    else
      echo "  下载失败 (HTTP $http_code)，等待 ${RETRY_DELAY} 秒后重试..."
      sleep $RETRY_DELAY
    fi
    
    attempt=$((attempt + 1))
  done

  echo "  错误：下载失败，已重试 $MAX_RETRIES 次"
  return 1
}

fetch_latest_release() {
  local temp_file=$(mktemp)
  local attempt=1

  while [ $attempt -le $MAX_RETRIES ]; do
    echo "  尝试请求 API ($attempt/$MAX_RETRIES)..."
    
    local http_code
    http_code=$(curl -s --connect-timeout 10 --max-time 30 -w "%{http_code}" -o "$temp_file" "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "429" ]; then
      echo "  GitHub API 限速 (429)，等待 10 秒后重试..."
      sleep 10
      attempt=$((attempt + 1))
      continue
    fi
    
    if [ "$http_code" = "200" ]; then
      local result
      result=$(cat "$temp_file")
      if [ -n "$result" ] && echo "$result" | jq -e '.tag_name' > /dev/null 2>&1; then
        echo "$result"
        rm -f "$temp_file"
        return 0
      fi
    fi
    
    echo "  请求失败 (HTTP $http_code)，等待 ${RETRY_DELAY} 秒后重试..."
    sleep $RETRY_DELAY
    attempt=$((attempt + 1))
  done

  rm -f "$temp_file"
  echo ""
  return 1
}

echo "======================================"
echo "  LPanel - 一键安装脚本"
echo "======================================"
echo ""

SPECIFIC_VERSION="$1"

echo "[1/8] 检测系统环境..."
if ! command -v curl &> /dev/null; then
  echo "安装 curl..."
  sudo apt update && sudo apt install -y curl
fi

if ! command -v jq &> /dev/null; then
  echo "安装 jq..."
  sudo apt install -y jq
fi

if ! command -v unzip &> /dev/null; then
  echo "安装 unzip..."
  sudo apt install -y unzip
fi

if ! command -v make &> /dev/null; then
  echo "安装编译工具..."
  sudo apt install -y build-essential python3
fi

echo "安装压缩解压工具..."
if ! command -v tar &> /dev/null; then
  sudo apt install -y tar
fi
if ! command -v gzip &> /dev/null; then
  sudo apt install -y gzip
fi
if ! command -v unzip &> /dev/null; then
  sudo apt install -y unzip
fi
if ! command -v unrar &> /dev/null; then
  sudo apt install -y unrar
fi

echo "[2/8] 获取最新版本..."

if [ -n "$SPECIFIC_VERSION" ]; then
  echo "  使用指定版本: $SPECIFIC_VERSION"
  VERSION="$SPECIFIC_VERSION"
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/lpanel-$VERSION.zip"
else
  LATEST_RELEASE=$(fetch_latest_release)

  if [ -z "$LATEST_RELEASE" ]; then
    echo "错误：无法获取最新版本信息"
    echo ""
    echo "您可以手动指定版本号安装，例如："
    echo "  curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- v1.0.0"
    exit 1
  fi

  VERSION=$(echo "$LATEST_RELEASE" | jq -r '.tag_name')
  DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | jq -r '.assets[] | select(.name | test("\\.zip$")) | .browser_download_url')

  if [ -z "$DOWNLOAD_URL" ]; then
    echo "  警告：未找到下载链接，尝试直接构造下载地址"
    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/lpanel-$VERSION.zip"
  fi
fi

echo "  版本: $VERSION"
echo "  下载地址: $DOWNLOAD_URL"

echo ""
echo "[3/8] 下载安装包..."
mkdir -p "$DOWNLOAD_DIR"

if ! download_with_retry "$DOWNLOAD_URL" "$DOWNLOAD_DIR/lpanel.zip"; then
  echo "错误：下载安装包失败"
  echo ""
  echo "您可以手动下载安装包后上传到服务器："
  echo "  $DOWNLOAD_URL"
  echo ""
  echo "然后运行："
  echo "  unzip lpanel-$VERSION.zip -d /opt/lpanel"
  echo "  cd /opt/lpanel/lpanel/server && npm install && npm run prisma:generate"
  exit 1
fi

echo "  安装包大小: $(du -h "$DOWNLOAD_DIR/lpanel.zip" | cut -f1)"

echo ""
echo "[4/8] 解压安装包..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
unzip -q "$DOWNLOAD_DIR/lpanel.zip" -d "$INSTALL_DIR"

if [ -d "$INSTALL_DIR/lpanel/server" ]; then
  SERVER_DIR="$INSTALL_DIR/lpanel/server"
elif [ -d "$INSTALL_DIR/lpanel" ] && [ -f "$INSTALL_DIR/lpanel/package.json" ]; then
  SERVER_DIR="$INSTALL_DIR/lpanel"
else
  echo "错误：无法找到 server 目录"
  exit 1
fi

echo ""
echo "[5/8] 安装系统依赖..."

echo "  安装 Node.js 24..."
NEED_INSTALL_NODE=false
if ! command -v node &> /dev/null; then
  NEED_INSTALL_NODE=true
elif ! node -v 2>/dev/null | grep -qE "^v24\."; then
  echo "  当前 Node.js 版本: $(node -v)，需要升级到 v24.x"
  NEED_INSTALL_NODE=true
fi

if [ "$NEED_INSTALL_NODE" = "true" ]; then
  NODE_MAJOR="24"
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then
    NODE_ARCH="linux-x64"
  elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    NODE_ARCH="linux-arm64"
  else
    NODE_ARCH="linux-x64"
  fi

  NODE_VERSION=$(curl -s https://nodejs.org/dist/latest-v$NODE_MAJOR.x/ | grep -oP 'node-v\K[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)
  if [ -z "$NODE_VERSION" ]; then
    NODE_VERSION="24.14.0"
  fi
  NODE_FULL_VERSION="v$NODE_VERSION"

  echo "  下载 Node.js $NODE_FULL_VERSION..."
  curl -fsSL "https://nodejs.org/dist/$NODE_FULL_VERSION/node-$NODE_FULL_VERSION-$NODE_ARCH.tar.xz" -o /tmp/node.tar.xz
  sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
  rm /tmp/node.tar.xz
  echo "  Node.js 安装完成: $(node -v)"
fi

echo "  安装 PostgreSQL..."
if ! command -v psql &> /dev/null; then
  sudo apt install -y postgresql postgresql-contrib
  sudo systemctl enable postgresql
  sudo systemctl start postgresql
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
ADMIN_USERNAME=$(generate_random_username)
ADMIN_PASSWORD=$(generate_random_password)
PANEL_PORT=$(generate_random_port)

sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='lpanel'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE lpanel;"

if sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='lpanel'" | grep -q 1; then
  sudo -u postgres psql -c "ALTER USER lpanel WITH PASSWORD '$DB_PASSWORD';"
else
  sudo -u postgres psql -c "CREATE USER lpanel WITH PASSWORD '$DB_PASSWORD';"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lpanel TO lpanel;"
sudo -u postgres psql -d lpanel -c "GRANT ALL ON SCHEMA public TO lpanel;"
sudo -u postgres psql -d lpanel -c "ALTER SCHEMA public OWNER TO lpanel;"

echo ""
echo "[7/8] 配置环境变量..."
cd "$SERVER_DIR"

cat > .env << EOF
PORT=$PANEL_PORT
HOST=0.0.0.0

DATABASE_URL="postgresql://lpanel:$DB_PASSWORD@localhost:5432/lpanel?schema=public"

JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"

ADMIN_USERNAME="$ADMIN_USERNAME"
ADMIN_PASSWORD="$ADMIN_PASSWORD"

LOG_LEVEL="info"
EOF

echo "  安装 npm 依赖..."
npm install

echo "  生成 Prisma Client..."
npx prisma generate

echo "  执行数据库迁移..."
npx prisma db push

echo ""
echo "[8/8] 开放防火墙端口..."
open_firewall_port $PANEL_PORT

echo ""
echo "  配置 systemd 服务..."
cat > /etc/systemd/system/lpanel.service << EOF
[Unit]
Description=LPanel - Linux Server Management Panel
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$SERVER_DIR
ExecStart=/usr/local/bin/node dist/app.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable lpanel

ACCESS_IP=$(get_access_ip)

echo ""
echo "======================================"
echo "   安装完成！"
echo "======================================"
echo ""
echo "访问地址: http://$ACCESS_IP:$PANEL_PORT"
echo ""
echo "登录凭据:"
echo "  用户名: $ADMIN_USERNAME"
echo "  密码: $ADMIN_PASSWORD"
echo ""
echo "服务管理:"
echo "  启动服务: systemctl start lpanel"
echo "  停止服务: systemctl stop lpanel"
echo "  重启服务: systemctl restart lpanel"
echo "  查看状态: systemctl status lpanel"
echo "  查看日志: journalctl -u lpanel -f"
echo ""
echo "立即启动服务..."
systemctl start lpanel

sleep 2
if systemctl is-active --quiet lpanel; then
  echo "  服务启动成功！"
else
  echo "  警告：服务启动失败，请手动检查："
  echo "  systemctl status lpanel"
  echo "  journalctl -u lpanel -e"
fi
echo ""
echo "其他信息:"
echo "  端口: $PANEL_PORT"
echo "  数据库密码: $DB_PASSWORD"
echo "  JWT密钥: $JWT_SECRET"
echo "  安装目录: $SERVER_DIR"
echo ""
echo "======================================"

rm -rf "$DOWNLOAD_DIR"