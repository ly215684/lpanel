export interface User {
  id: string
  username: string
  email: string
  role: string
  status: boolean
  created_at: Date
  updated_at: Date
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface SystemInfo {
  hostname: string
  os: string
  kernel: string
  uptime: number
}

export interface CPUInfo {
  model: string
  cores: number
  usage: number
}

export interface MemoryInfo {
  total: number
  used: number
  free: number
  cached: number
  usage: number
}

export interface DiskInfo {
  mount: string
  total: number
  used: number
  free: number
  usage: number
  filesystem: string
}

export interface NetworkInfo {
  interface: string
  ip: string
  mac: string
  rx: number
  tx: number
}

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  permissions: string
  owner: string
  group: string
  modifiedAt: Date
}

export interface CreateWebsiteRequest {
  name: string
  domain: string
  web_server: 'nginx' | 'apache'
  root_path: string
}

export interface CreateDatabaseRequest {
  name: string
  type: 'mysql' | 'postgresql'
  username: string
  password: string
}

export interface CreateTaskRequest {
  name: string
  type: 'backup' | 'command' | 'custom'
  cron_expression: string
  command?: string
}

export interface Permission {
  action: string
  resource: string
}

export interface RolePermissions {
  [key: string]: Permission[]
}

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
}

export const PERMISSIONS: RolePermissions = {
  admin: [
    { action: 'manage', resource: 'users' },
    { action: 'manage', resource: 'monitor' },
    { action: 'manage', resource: 'websites' },
    { action: 'manage', resource: 'databases' },
    { action: 'manage', resource: 'files' },
    { action: 'manage', resource: 'containers' },
    { action: 'manage', resource: 'tasks' }
  ],
  user: [
    { action: 'view', resource: 'monitor' },
    { action: 'view', resource: 'websites' },
    { action: 'view', resource: 'databases' },
    { action: 'view', resource: 'files' },
    { action: 'view', resource: 'containers' },
    { action: 'view', resource: 'tasks' }
  ]
}
