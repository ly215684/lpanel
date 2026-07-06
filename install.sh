#!/bin/bash

set -e

REPO="ly215684/lpanel"
INSTALL_DIR="/opt/lpanel"
DOWNLOAD_DIR="/tmp/lpanel-install"
MAX_RETRIES=5
RETRY_DELAY=5

MIRROR_LIST=(
  "https://ghproxy.com"
  "https://gh.api.99988866.xyz"
  "https://mirror.ghproxy.com"
  "https://gh-proxy.com"
)

API_MIRROR_LIST=(
  "https://ghproxy.com/https://api.github.com"
  "https://mirror.ghproxy.com/https://api.github.com"
)

download_with_retry() {
  local url=$1
  local output=$2
  local use_mirror=${3:-false}
  local attempt=1
  local mirror_index=0

  while [ $attempt -le $MAX_RETRIES ]; do
    echo "  尝试下载 ($attempt/$MAX_RETRIES)..."
    
    local download_url="$url"
    if [ "$use_mirror" = "true" ] && [ $mirror_index -lt ${#MIRROR_LIST[@]} ]; then
      download_url="${MIRROR_LIST[$mirror_index]}/$url"
      echo "  使用镜像: ${MIRROR_LIST[$mirror_index]}"
    fi
    
    local http_code
    http_code=$(curl -L --connect-timeout 15 --max-time 300 -w "%{http_code}" -o "$output" "$download_url" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
      echo "  下载成功！"
      return 0
    fi
    
    echo "  下载失败 (HTTP $http_code)，等待 ${RETRY_DELAY} 秒后重试..."
    sleep $RETRY_DELAY
    attempt=$((attempt + 1))
    
    if [ $((attempt % 2)) -eq 0 ] && [ "$use_mirror" = "true" ] && [ $mirror_index -lt $((${#MIRROR_LIST[@]} - 1)) ]; then
      mirror_index=$((mirror_index + 1))
    fi
  done

  echo "  错误：下载失败，已重试 $MAX_RETRIES 次"
  return 1
}

fetch_api_with_retry() {
  local url=$1
  local attempt=1

  while [ $attempt -le $MAX_RETRIES ]; do
    echo "  尝试请求 API ($attempt/$MAX_RETRIES)..."
    
    local result
    local http_code
    result=$(curl -s --connect-timeout 10 --max-time 30 -w "\n%{http_code}" "$url" 2>/dev/null || true)
    
    http_code=$(echo "$result" | tail -n 1)
    result=$(echo "$result" | sed '$d')
    
    if [ "$http_code" = "429" ]; then
      echo "  GitHub API 限速 (429)，等待 10 秒后重试..."
      sleep 10
      attempt=$((attempt + 1))
      continue
    fi
    
    if [ "$http_code" = "200" ] && [ -n "$result" ] && echo "$result" | jq -e '.tag_name' > /dev/null 2>&1; then
      echo "$result"
      return 0
    fi
    
    echo "  请求失败 (HTTP $http_code)，等待 ${RETRY_DELAY} 秒后重试..."
    sleep $RETRY_DELAY
    attempt=$((attempt + 1))
  done

  echo ""
  return 1
}

get_latest_version_fallback() {
  echo "  正在尝试从镜像站获取版本信息..."
  
  for mirror in "${API_MIRROR_LIST[@]}"; do
    echo "  尝试镜像: $mirror"
    local result
    result=$(curl -s --connect-timeout 10 --max-time 30 "$mirror/repos/$REPO/releases/latest" 2>/dev/null || true)
    
    if [ -n "$result" ] && echo "$result" | jq -e '.tag_name' > /dev/null 2>&1; then
      echo "$result"
      return 0
    fi
  done
  
  echo ""
  return 1
}

download_version_direct() {
  local version=$1
  local output=$2
  
  echo "  正在尝试从镜像站直接下载 $version ..."
  
  for mirror in "${MIRROR_LIST[@]}"; do
    local download_url="$mirror/https://github.com/$REPO/releases/download/$version/lpanel-$version.zip"
    echo "  尝试: $mirror"
    
    local http_code
    http_code=$(curl -L --connect-timeout 15 --max-time 300 -w "%{http_code}" -o "$output" "$download_url" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
      echo "  下载成功！"
      return 0
    fi
  done
  
  return 1
}

generate_random_string() {
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1
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

echo "[2/8] 获取最新版本..."

if [ -n "$SPECIFIC_VERSION" ]; then
  echo "  使用指定版本: $SPECIFIC_VERSION"
  VERSION="$SPECIFIC_VERSION"
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/lpanel-$VERSION.zip"
else
  LATEST_RELEASE=$(fetch_api_with_retry "https://api.github.com/repos/$REPO/releases/latest")

  if [ -z "$LATEST_RELEASE" ]; then
    echo "  警告：无法通过 GitHub API 获取版本信息"
    echo "  正在尝试从镜像站获取..."
    LATEST_RELEASE=$(get_latest_version_fallback)
  fi

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

download_success=false

if download_with_retry "$DOWNLOAD_URL" "$DOWNLOAD_DIR/lpanel.zip" "false"; then
  download_success=true
fi

if [ "$download_success" = "false" ]; then
  echo "  直接下载失败，尝试使用镜像源..."
  if download_with_retry "$DOWNLOAD_URL" "$DOWNLOAD_DIR/lpanel.zip" "true"; then
    download_success=true
  fi
fi

if [ "$download_success" = "false" ]; then
  echo "  镜像下载失败，尝试直接从镜像站下载..."
  if download_version_direct "$VERSION" "$DOWNLOAD_DIR/lpanel.zip"; then
    download_success=true
  fi
fi

if [ "$download_success" = "false" ]; then
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
PANEL_PORT=$(generate_random_port)

sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='lpanel'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE lpanel;"

sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='lpanel'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER lpanel WITH PASSWORD '$DB_PASSWORD';"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lpanel TO lpanel;"

echo ""
echo "[7/8] 配置环境变量..."
cd "$INSTALL_DIR/lpanel/server"

cat > .env << EOF
PORT=$PANEL_PORT
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
echo "[9/9] 开放防火墙端口..."
open_firewall_port $PANEL_PORT

echo ""
echo "[10/10] 获取访问地址..."
ACCESS_IP=$(get_access_ip)

echo ""
echo "======================================"
echo "   安装完成！"
echo "======================================"
echo ""
echo "访问地址: http://$ACCESS_IP:$PANEL_PORT"
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