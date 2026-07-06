# LPanel - Linux Server Management Panel

一个功能强大的 Linux 服务器管理面板，基于 Node.js 和 Vue.js 构建，支持多种常见 Linux 发行版。

## 功能特性

### 🔐 用户认证
- JWT 双令牌认证（Access Token + Refresh Token）
- RBAC 权限管理（管理员/普通用户）
- 登录状态持久化

### 📊 服务器监控
- CPU、内存、磁盘、网络实时监控
- WebSocket 实时数据推送
- 历史趋势图表展示（ECharts）
- 系统信息概览

### 🌐 网站管理
- Nginx/Apache 配置管理
- SSL 证书管理（Let's Encrypt）
- 网站状态监控
- 虚拟主机配置

### 💾 数据库管理
- MySQL/PostgreSQL 数据库管理
- 数据库创建、备份、恢复
- 备份文件管理

### 📁 文件管理
- 文件上传、下载、编辑
- 目录创建、删除、重命名
- 文件权限设置（chmod）
- 文件内容编辑器

### 🐳 容器管理
- Docker 镜像管理（拉取、删除）
- 容器生命周期管理（创建、启动、停止、删除）
- 容器日志查看
- 端口映射配置

### ⏰ 任务计划
- Cron 定时任务管理
- 任务执行记录
- 手动执行任务
- 备份任务自动化

## 技术栈

### 后端
- **框架**: Fastify 4.x
- **语言**: TypeScript
- **数据库**: PostgreSQL 16.x
- **ORM**: Prisma 5.x
- **认证**: JWT
- **实时通信**: Socket.io 4.x

### 前端
- **框架**: Vue 3 + Vite 6.x
- **语言**: TypeScript
- **UI 组件**: Element Plus 2.x
- **状态管理**: Pinia
- **图表库**: ECharts
- **路由**: Vue Router 4.x

### 系统交互
- Docker API
- systemctl 命令
- Shell 命令执行（安全白名单）

## 系统要求

- Linux 发行版（Ubuntu 22.04+ 推荐）
- Node.js 20.x LTS
- PostgreSQL 16.x
- Docker（容器管理功能）
- Nginx/Apache（网站管理功能）

## 快速开始

### 方式一：使用安装脚本

```bash
git clone https://github.com/your-username/lpanel.git
cd lpanel
chmod +x scripts/install.sh
sudo ./scripts/install.sh
```

### 方式二：手动安装

#### 1. 安装依赖

```bash
# 后端依赖
cd server
npm install

# 前端依赖
cd ../web
npm install
cd ..
```

#### 2. 配置数据库

```bash
# 创建数据库
sudo -u postgres psql
CREATE DATABASE lpanel;
CREATE USER lpanel WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE lpanel TO lpanel;
\q
```

#### 3. 配置环境变量

```bash
cd server
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=3000
HOST=0.0.0.0
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1h
DATABASE_URL="postgresql://lpanel:your-password@localhost:5432/lpanel"
ADMIN_PASSWORD=admin123
LOG_LEVEL=info
```

> **注意**: 使用安装脚本时，以上密码和密钥会自动随机生成，无需手动配置。

#### 4. 数据库迁移

```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
```

#### 5. 启动服务

**开发模式：**

```bash
# 后端（终端1）
cd server
npm run dev

# 前端（终端2）
cd web
npm run dev
```

**生产模式：**

```bash
# 构建前端
cd web
npm run build
cp -r dist ../server/public

# 构建并启动后端
cd server
npm run build
npm run start
```

## 访问面板

- 前端地址: http://localhost:5173
- 后端 API: http://localhost:3000

**默认凭据：**
- 用户名: `admin`
- 密码: `admin123`

## 项目结构

```
lpanel/
├── server/                 # 后端服务
│   ├── src/
│   │   ├── app.ts         # 应用入口
│   │   ├── config/        # 配置文件
│   │   ├── core/          # 核心模块（命令执行、安全、日志）
│   │   ├── middleware/    # 中间件（认证、权限）
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务逻辑
│   │   └── sockets/       # WebSocket 处理
│   ├── prisma/            # Prisma 配置
│   └── package.json
├── web/                   # 前端应用
│   ├── src/
│   │   ├── components/    # 公共组件
│   │   ├── views/         # 页面组件
│   │   ├── api/           # API 调用
│   │   ├── stores/        # 状态管理
│   │   ├── router/        # 路由配置
│   │   └── utils/         # 工具函数
│   └── package.json
├── scripts/               # 部署脚本
│   ├── install.sh         # 安装脚本
│   ├── start.sh           # 启动脚本
│   ├── build.sh           # 构建脚本
│   └── uninstall.sh       # 卸载脚本
└── README.md
```

## 安全说明

1. **命令白名单**: 所有系统命令执行都经过白名单校验，防止命令注入
2. **最小权限**: 使用 sudoers 配置最小权限，避免 root 权限滥用
3. **JWT 认证**: 使用安全的 JWT 令牌机制，支持令牌刷新
4. **CORS 配置**: 严格的跨域访问控制
5. **输入校验**: 所有用户输入都经过严格校验

## 开发说明

### 添加新功能

1. 在 `server/src/routes/` 添加新路由
2. 在 `server/src/services/` 添加业务逻辑
3. 在 `web/src/api/` 添加 API 调用
4. 在 `web/src/views/` 创建新页面
5. 在 `web/src/router/` 注册路由

### 代码规范

- 使用 ESLint + Prettier 进行代码检查
- 遵循 TypeScript 类型规范
- 前端使用 Composition API
- 后端使用 Fastify 最佳实践

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！