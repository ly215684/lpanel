# Linux服务器管理面板 (LPanel) 实现计划

## 一、项目概述

LPanel 是一个基于 Node.js + Vue.js 的 Linux 服务器管理面板，支持 Ubuntu、Debian、CentOS 等常见 Linux 发行版，提供用户认证、服务器监控、网站管理、数据库管理、文件管理、容器管理和任务计划等核心功能。

## 二、技术选型

| 分类 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 后端语言 | Node.js | 20.x LTS | 前后端统一语言 |
| 前端框架 | Vue.js | 3.x | 渐进式前端框架 |
| 前端构建工具 | Vite | 6.x | 快速开发构建工具 |
| UI组件库 | Element Plus | 2.x | Vue 3 组件库 |
| 后端框架 | Fastify | 4.x | 高性能 Node.js 框架 |
| ORM | Prisma | 5.x | PostgreSQL ORM |
| 数据库 | PostgreSQL | 16.x | 复杂数据存储 |
| 实时通信 | Socket.io | 4.x | WebSocket 实时更新 |
| 认证 | JWT | - | JSON Web Token |
| 容器交互 | Docker API | - | 通过 HTTP API 管理容器 |

## 三、安全架构设计

### 3.1 命令执行层

- **命令白名单机制**：所有系统命令必须在白名单中定义
- **参数校验**：严格校验命令参数，防止 Shell 注入
- **权限隔离**：使用非 root 用户运行面板，通过 sudoers 配置必要权限
- **命令日志**：记录所有系统命令执行记录

### 3.2 认证与授权

- **JWT + Refresh Token**：双 Token 机制
- **RBAC 权限模型**：角色-权限-资源映射
- **会话管理**：支持会话过期、强制下线

### 3.3 Sudoers 配置

配置 `lpanel` 用户免密执行特定命令：

```
lpanel ALL=(ALL) NOPASSWD: /bin/systemctl status *
lpanel ALL=(ALL) NOPASSWD: /bin/systemctl restart *
lpanel ALL=(ALL) NOPASSWD: /usr/bin/docker *
lpanel ALL=(ALL) NOPASSWD: /usr/bin/mysql *
lpanel ALL=(ALL) NOPASSWD: /usr/bin/psql *
```

## 四、项目结构

```
lpanel/
├── server/                          # 后端服务
│   ├── src/
│   │   ├── app.ts                   # 应用入口
│   │   ├── config/                  # 配置文件
│   │   │   ├── index.ts
│   │   │   └── env.ts
│   │   ├── core/                    # 核心模块
│   │   │   ├── command.ts           # 命令执行器
│   │   │   ├── logger.ts            # 日志系统
│   │   │   └── security.ts          # 安全模块
│   │   ├── routes/                  # 路由模块
│   │   │   ├── auth.ts              # 认证路由
│   │   │   ├── monitor.ts           # 监控路由
│   │   │   ├── websites.ts          # 网站管理路由
│   │   │   ├── databases.ts         # 数据库路由
│   │   │   ├── files.ts             # 文件管理路由
│   │   │   ├── containers.ts        # 容器路由
│   │   │   └── tasks.ts             # 任务计划路由
│   │   ├── services/                # 业务服务
│   │   │   ├── auth.ts
│   │   │   ├── monitor.ts
│   │   │   ├── websites.ts
│   │   │   ├── databases.ts
│   │   │   ├── files.ts
│   │   │   ├── containers.ts
│   │   │   └── tasks.ts
│   │   ├── middleware/              # 中间件
│   │   │   ├── auth.ts              # 认证中间件
│   │   │   └── rbac.ts              # 权限中间件
│   │   ├── sockets/                 # WebSocket 模块
│   │   │   └── monitor.ts
│   │   └── types/                   # TypeScript 类型
│   │       └── index.ts
│   ├── prisma/                      # Prisma ORM
│   │   └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
├── web/                             # 前端项目
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── components/              # 公共组件
│   │   │   ├── Layout.vue
│   │   │   ├── Sidebar.vue
│   │   │   └── Header.vue
│   │   ├── views/                   # 页面视图
│   │   │   ├── auth/                # 认证页面
│   │   │   │   └── Login.vue
│   │   │   ├── dashboard/           # 仪表盘
│   │   │   │   └── Index.vue
│   │   │   ├── monitor/             # 监控页面
│   │   │   │   └── Index.vue
│   │   │   ├── websites/            # 网站管理
│   │   │   │   ├── Index.vue
│   │   │   │   ├── List.vue
│   │   │   │   └── Config.vue
│   │   │   ├── databases/           # 数据库管理
│   │   │   │   ├── Index.vue
│   │   │   │   ├── List.vue
│   │   │   │   └── Backup.vue
│   │   │   ├── files/               # 文件管理
│   │   │   │   ├── Index.vue
│   │   │   │   └── Editor.vue
│   │   │   ├── containers/          # 容器管理
│   │   │   │   ├── Index.vue
│   │   │   │   ├── Images.vue
│   │   │   │   └── Containers.vue
│   │   │   ├── tasks/               # 任务计划
│   │   │   │   ├── Index.vue
│   │   │   │   └── Create.vue
│   │   │   └── users/               # 用户管理
│   │   │       └── Index.vue
│   │   ├── api/                     # API 接口
│   │   │   └── index.ts
│   │   ├── stores/                  # 状态管理
│   │   │   └── auth.ts
│   │   ├── utils/                   # 工具函数
│   │   │   └── request.ts
│   │   └── styles/                  # 样式文件
│   │       └── global.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── scripts/                         # 部署脚本
│   ├── install.sh                   # 一键安装脚本
│   └── lpanel.service               # systemd 服务配置
└── README.md
```

## 五、数据库设计

### 5.1 用户表 (users)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | VARCHAR(50) | 用户名（唯一） |
| email | VARCHAR(100) | 邮箱（唯一） |
| password_hash | VARCHAR(255) | 密码哈希 |
| role | VARCHAR(20) | 角色（admin/user） |
| status | BOOLEAN | 状态（启用/禁用） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 5.2 会话表 (sessions)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| refresh_token | VARCHAR(255) | 刷新令牌 |
| expires_at | TIMESTAMP | 过期时间 |
| ip_address | VARCHAR(50) | IP地址 |
| created_at | TIMESTAMP | 创建时间 |

### 5.3 网站配置表 (websites)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(100) | 网站名称 |
| domain | VARCHAR(200) | 域名 |
| web_server | VARCHAR(20) | Web服务器（nginx/apache） |
| config_path | VARCHAR(500) | 配置文件路径 |
| ssl_enabled | BOOLEAN | SSL启用状态 |
| ssl_cert_path | VARCHAR(500) | SSL证书路径 |
| ssl_key_path | VARCHAR(500) | SSL密钥路径 |
| status | VARCHAR(20) | 状态（running/stopped） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 5.4 数据库表 (databases)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(100) | 数据库名称 |
| type | VARCHAR(20) | 类型（mysql/postgresql） |
| host | VARCHAR(100) | 主机地址 |
| port | INTEGER | 端口号 |
| username | VARCHAR(50) | 用户名 |
| password_hash | VARCHAR(255) | 密码哈希 |
| status | VARCHAR(20) | 状态（active/inactive） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 5.5 备份记录表 (backups)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| database_id | UUID | 关联数据库ID |
| type | VARCHAR(20) | 备份类型（full/incremental） |
| path | VARCHAR(500) | 备份文件路径 |
| size | BIGINT | 文件大小（字节） |
| status | VARCHAR(20) | 状态（success/failed） |
| created_at | TIMESTAMP | 创建时间 |

### 5.6 任务计划表 (tasks)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(100) | 任务名称 |
| type | VARCHAR(20) | 任务类型（backup/command/custom） |
| cron_expression | VARCHAR(50) | Cron 表达式 |
| command | TEXT | 执行命令 |
| status | VARCHAR(20) | 状态（enabled/disabled） |
| last_run_at | TIMESTAMP | 上次执行时间 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 5.7 任务执行记录表 (task_executions)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| task_id | UUID | 关联任务ID |
| status | VARCHAR(20) | 状态（running/success/failed） |
| output | TEXT | 执行输出 |
| error | TEXT | 错误信息 |
| started_at | TIMESTAMP | 开始时间 |
| finished_at | TIMESTAMP | 结束时间 |

## 六、实现阶段规划

### Phase 0: 项目脚手架搭建

**目标**：初始化项目结构，配置基础环境

**步骤**：
1. 创建项目目录结构
2. 初始化 server 端（Fastify + TypeScript + Prisma）
3. 初始化 web 端（Vue 3 + Vite + TypeScript + Element Plus）
4. 配置 ESLint + Prettier
5. 初始化 Prisma 数据库连接

**输出文件**：
- `server/package.json`
- `server/tsconfig.json`
- `server/prisma/schema.prisma`
- `web/package.json`
- `web/vite.config.ts`
- `web/tsconfig.json`

### Phase 1: 用户认证与核心基础设施

**目标**：实现登录认证、权限管理、命令执行层

**步骤**：
1. 实现 JWT 认证机制（登录、刷新令牌、登出）
2. 实现 RBAC 权限模型（角色定义、权限校验中间件）
3. 实现命令执行器（白名单、参数校验、安全执行）
4. 实现日志系统
5. 数据库迁移（用户表、会话表）

**输出文件**：
- `server/src/routes/auth.ts`
- `server/src/services/auth.ts`
- `server/src/middleware/auth.ts`
- `server/src/middleware/rbac.ts`
- `server/src/core/command.ts`
- `server/src/core/logger.ts`
- `web/src/views/auth/Login.vue`
- `web/src/stores/auth.ts`

### Phase 2: 服务器状态监控

**目标**：实现 CPU、内存、磁盘、网络实时监控

**步骤**：
1. 实现系统监控 API（CPU 使用率、内存使用、磁盘空间、网络流量）
2. 实现 WebSocket 实时推送
3. 前端仪表盘展示（实时图表）
4. 历史数据记录（可选）

**输出文件**：
- `server/src/routes/monitor.ts`
- `server/src/services/monitor.ts`
- `server/src/sockets/monitor.ts`
- `web/src/views/dashboard/Index.vue`
- `web/src/views/monitor/Index.vue`

### Phase 3: 文件管理

**目标**：实现文件上传、下载、编辑、权限设置

**步骤**：
1. 实现文件列表 API
2. 实现文件上传下载 API
3. 实现文件编辑 API
4. 实现文件权限设置 API
5. 前端文件管理器界面

**输出文件**：
- `server/src/routes/files.ts`
- `server/src/services/files.ts`
- `web/src/views/files/Index.vue`
- `web/src/views/files/Editor.vue`

### Phase 4: 网站管理

**目标**：实现 Nginx/Apache 配置管理、SSL 证书

**步骤**：
1. 实现网站列表 API
2. 实现网站创建/编辑 API
3. 实现 Nginx/Apache 配置生成
4. 实现 SSL 证书管理（Let's Encrypt 集成）
5. 前端网站管理界面

**输出文件**：
- `server/src/routes/websites.ts`
- `server/src/services/websites.ts`
- `web/src/views/websites/Index.vue`
- `web/src/views/websites/List.vue`
- `web/src/views/websites/Config.vue`

### Phase 5: 数据库管理

**目标**：实现 MySQL/PostgreSQL 创建、备份、恢复

**步骤**：
1. 实现数据库列表 API
2. 实现数据库创建/删除 API
3. 实现数据库备份 API
4. 实现数据库恢复 API
5. 前端数据库管理界面

**输出文件**：
- `server/src/routes/databases.ts`
- `server/src/services/databases.ts`
- `web/src/views/databases/Index.vue`
- `web/src/views/databases/List.vue`
- `web/src/views/databases/Backup.vue`

### Phase 6: 容器管理

**目标**：实现 Docker 镜像、容器生命周期管理

**步骤**：
1. 实现 Docker API 集成
2. 实现镜像管理 API（拉取、列表、删除）
3. 实现容器管理 API（创建、启动、停止、删除、日志）
4. 前端容器管理界面

**输出文件**：
- `server/src/routes/containers.ts`
- `server/src/services/containers.ts`
- `web/src/views/containers/Index.vue`
- `web/src/views/containers/Images.vue`
- `web/src/views/containers/Containers.vue`

### Phase 7: 任务计划

**目标**：实现定时任务、备份任务

**步骤**：
1. 实现任务列表 API
2. 实现任务创建/编辑 API
3. 实现 Cron 调度器集成
4. 实现任务执行记录
5. 前端任务管理界面

**输出文件**：
- `server/src/routes/tasks.ts`
- `server/src/services/tasks.ts`
- `web/src/views/tasks/Index.vue`
- `web/src/views/tasks/Create.vue`

### Phase 8: 部署与打包

**目标**：实现一键安装脚本、系统服务配置

**步骤**：
1. 创建 systemd 服务配置文件
2. 创建一键安装脚本
3. 前端打包优化
4. 后端生产环境配置

**输出文件**：
- `scripts/install.sh`
- `scripts/lpanel.service`

## 七、API 接口设计

### 7.1 认证接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/refresh | 刷新令牌 |
| POST | /api/auth/logout | 用户登出 |
| GET | /api/auth/me | 获取当前用户 |

### 7.2 监控接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/monitor/system | 获取系统状态 |
| GET | /api/monitor/cpu | 获取 CPU 信息 |
| GET | /api/monitor/memory | 获取内存信息 |
| GET | /api/monitor/disk | 获取磁盘信息 |
| GET | /api/monitor/network | 获取网络信息 |

### 7.3 文件管理接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/files/list | 列出文件 |
| POST | /api/files/upload | 上传文件 |
| GET | /api/files/download | 下载文件 |
| PUT | /api/files/edit | 编辑文件内容 |
| PUT | /api/files/chmod | 修改文件权限 |
| DELETE | /api/files/delete | 删除文件 |

### 7.4 网站管理接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/websites | 获取网站列表 |
| POST | /api/websites | 创建网站 |
| GET | /api/websites/:id | 获取网站详情 |
| PUT | /api/websites/:id | 更新网站配置 |
| DELETE | /api/websites/:id | 删除网站 |
| POST | /api/websites/:id/enable-ssl | 启用 SSL |

### 7.5 数据库管理接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/databases | 获取数据库列表 |
| POST | /api/databases | 创建数据库 |
| DELETE | /api/databases/:id | 删除数据库 |
| POST | /api/databases/:id/backup | 备份数据库 |
| POST | /api/databases/:id/restore | 恢复数据库 |
| GET | /api/databases/:id/backups | 获取备份列表 |

### 7.6 容器管理接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/containers/images | 获取镜像列表 |
| POST | /api/containers/images/pull | 拉取镜像 |
| DELETE | /api/containers/images/:id | 删除镜像 |
| GET | /api/containers | 获取容器列表 |
| POST | /api/containers | 创建容器 |
| POST | /api/containers/:id/start | 启动容器 |
| POST | /api/containers/:id/stop | 停止容器 |
| DELETE | /api/containers/:id | 删除容器 |
| GET | /api/containers/:id/logs | 获取容器日志 |

### 7.7 任务计划接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tasks | 获取任务列表 |
| POST | /api/tasks | 创建任务 |
| PUT | /api/tasks/:id | 更新任务 |
| DELETE | /api/tasks/:id | 删除任务 |
| POST | /api/tasks/:id/run | 立即执行任务 |
| GET | /api/tasks/:id/executions | 获取执行记录 |

## 八、风险与注意事项

### 8.1 安全风险

- **命令注入**：严格校验所有命令参数，使用参数化执行
- **权限滥用**：最小权限原则，限制 sudo 命令范围
- **敏感信息泄露**：密码加密存储，日志脱敏处理
- **暴力破解**：登录失败次数限制，账号锁定机制

### 8.2 性能风险

- **监控频率**：合理设置监控间隔，避免频繁系统调用
- **日志管理**：定期清理日志，避免磁盘空间耗尽
- **并发处理**：使用异步非阻塞模式，避免阻塞事件循环

### 8.3 兼容性问题

- **发行版差异**：Ubuntu/Debian 使用 systemd，CentOS 使用 systemd
- **命令路径差异**：不同系统命令路径可能不同
- **包管理器差异**：apt vs yum/dnf

## 九、开发环境要求

- Node.js 20.x LTS
- npm/yarn/pnpm
- PostgreSQL 16.x
- Docker（容器管理功能）
- Git

## 十、部署步骤

1. 安装依赖：`npm install`
2. 配置环境变量：创建 `.env` 文件
3. 数据库迁移：`npx prisma migrate dev`
4. 构建前端：`cd web && npm run build`
5. 启动后端：`cd server && npm run start`
6. 配置 systemd 服务：`cp scripts/lpanel.service /etc/systemd/system/`
7. 启动服务：`systemctl enable --now lpanel`

## 十一、后续优化建议

1. **多服务器管理**：支持管理多台服务器
2. **告警系统**：监控指标告警通知
3. **审计日志**：完整操作审计记录
4. **API 文档**：自动生成 API 文档
5. **国际化**：多语言支持
6. **主题切换**：深色/浅色主题
