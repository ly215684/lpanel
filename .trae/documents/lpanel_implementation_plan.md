# LPanel 实现计划

## 项目状态分析

### 已完成
- ✅ 后端服务端（Fastify + TypeScript + Prisma）
- ✅ JWT认证机制
- ✅ RBAC权限模型
- ✅ 命令执行器和日志系统
- ✅ 服务器监控API和WebSocket
- ✅ 文件管理功能（API + 前端）
- ✅ 网站管理功能（API + 前端）
- ✅ 数据库管理功能（API）
- ✅ 容器管理功能（API）
- ✅ 任务计划功能（API）
- ✅ 前端框架搭建（Vue 3 + Vite + Element Plus）
- ✅ 前端页面：Login、Dashboard、Files、Websites、Monitor

### 待完成
- ❌ 前端页面：Databases、Containers、Tasks、Users
- ❌ 前端依赖安装
- ❌ 后端依赖安装
- ❌ Prisma数据库初始化
- ❌ ESLint + Prettier配置
- ❌ 部署脚本

## 实施步骤

### 阶段一：安装依赖

**后端依赖安装**
```bash
cd server && npm install
```

**前端依赖安装**
```bash
cd web && npm install
```

### 阶段二：创建缺失的前端页面组件

#### 2.1 数据库管理页面 (`web/src/views/databases/Index.vue`)
- 功能：数据库列表展示、创建数据库、删除数据库、备份数据库、恢复数据库
- 技术：Element Plus表格、对话框、表单

#### 2.2 容器管理页面 (`web/src/views/containers/Index.vue`)
- 功能：镜像列表、容器列表、拉取镜像、创建容器、启动/停止容器、查看日志
- 技术：Element Plus表格、对话框、标签页

#### 2.3 任务计划页面 (`web/src/views/tasks/Index.vue`)
- 功能：任务列表、创建任务、编辑任务、删除任务、手动执行任务、查看执行日志
- 技术：Element Plus表格、对话框、表单

#### 2.4 用户管理页面 (`web/src/views/users/Index.vue`)
- 功能：用户列表、创建用户、编辑用户、删除用户、角色分配
- 技术：Element Plus表格、对话框、表单

### 阶段三：Prisma数据库初始化

**步骤**
1. 配置 `.env` 文件（复制 `.env.example`）
2. 创建数据库迁移
3. 生成Prisma客户端

```bash
cd server
cp .env.example .env
# 编辑 .env 设置 DATABASE_URL
npx prisma migrate dev --name init
npx prisma generate
```

### 阶段四：配置 ESLint + Prettier

**后端配置**
- 安装：`eslint`, `prettier`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
- 创建：`.eslintrc.json`, `.prettierrc`

**前端配置**
- 安装：`eslint`, `prettier`, `eslint-plugin-vue`, `@vue/eslint-config-typescript`
- 创建：`.eslintrc.json`, `.prettierrc`

### 阶段五：创建部署脚本

**创建脚本**
- `scripts/install.sh`: 安装依赖和配置
- `scripts/start.sh`: 启动服务
- `scripts/build.sh`: 构建前端
- `scripts/uninstall.sh`: 卸载服务

## 文件结构变更

```
web/src/views/
├── databases/
│   └── Index.vue      # 新增
├── containers/
│   └── Index.vue      # 新增
├── tasks/
│   └── Index.vue      # 新增
└── users/
    └── Index.vue      # 新增

scripts/
├── install.sh         # 新增
├── start.sh           # 新增
├── build.sh           # 新增
└── uninstall.sh       # 新增

server/
├── .env               # 新增（从 .env.example 复制）

web/
├── .eslintrc.json     # 新增
├── .prettierrc        # 新增

server/
├── .eslintrc.json     # 新增
├── .prettierrc        # 新增
```

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Prisma客户端生成失败 | 数据库连接不可用 | 确保PostgreSQL服务正常运行 |
| 前端构建失败 | 页面无法访问 | 检查TypeScript类型错误 |
| Docker API不可用 | 容器管理功能异常 | 确保Docker服务正常运行 |
| 系统命令执行权限 | 功能受限 | 配置sudoers文件 |

## 验证计划

1. **依赖安装验证**：检查 `node_modules` 目录是否创建
2. **数据库连接验证**：运行 `npx prisma studio` 检查连接
3. **前端构建验证**：运行 `npm run build` 检查构建结果
4. **服务启动验证**：运行 `npm run dev` 检查服务是否正常启动
5. **功能验证**：通过浏览器访问各页面验证功能