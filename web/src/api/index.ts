import request from '@/utils/request'

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: {
    id: string
    username: string
    email: string
    role: string
    status: boolean
    created_at: string
    updated_at: string
  }
}

export async function loginApi(username: string, password: string): Promise<LoginResponse> {
  return request.post('/auth/login', { username, password })
}

export async function refreshTokenApi(refreshToken: string): Promise<LoginResponse> {
  return request.post('/auth/refresh', { refresh_token: refreshToken })
}

export async function logoutApi(refreshToken: string) {
  return request.post('/auth/logout', { refresh_token: refreshToken })
}

export interface User {
  id: string
  username: string
  email: string
  role: string
  status: boolean
  created_at: string
  updated_at: string
}

export async function getMeApi(): Promise<User> {
  return request.get('/auth/me')
}

export async function updateMeApi(data: { username?: string; email?: string; currentPassword: string }): Promise<User> {
  return request.put('/auth/me', data)
}

export async function changePasswordApi(currentPassword: string, newPassword: string) {
  return request.post('/auth/me/password', { currentPassword, newPassword })
}

export interface PanelSettings {
  panelTitle: string
  panelDescription: string
  monitorInterval: number
  maxFileSize: number
  defaultTheme: string
}

export async function getSettingsApi(): Promise<PanelSettings> {
  return request.get('/settings')
}

export async function updateSettingsApi(settings: Partial<PanelSettings>): Promise<PanelSettings> {
  return request.put('/settings', settings)
}

export interface MonitorData {
  system: {
    hostname: string
    os: string
    kernel: string
    uptime: number
  }
  cpu: {
    model: string
    cores: number
    usage: number
  }
  memory: {
    total: number
    used: number
    free: number
    cached: number
    usage: number
  }
  disk: {
    mount: string
    total: number
    used: number
    free: number
    usage: number
  }[]
  network: {
    interface: string
    rx: number
    tx: number
  }[]
}

export async function getMonitorAllApi(): Promise<MonitorData> {
  return request.get('/monitor/all')
}

export async function getSystemInfoApi() {
  return request.get('/monitor/system')
}

export async function getCPUInfoApi() {
  return request.get('/monitor/cpu')
}

export async function getMemoryInfoApi() {
  return request.get('/monitor/memory')
}

export async function getDiskInfoApi() {
  return request.get('/monitor/disk')
}

export async function getNetworkInfoApi() {
  return request.get('/monitor/network')
}

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  permissions: string
  owner: string
  group: string
  modifiedAt: string
}

export interface ReadFileResponse {
  content: string
}

export async function listFilesApi(path?: string): Promise<FileItem[]> {
  return request.get('/files/list', { params: { path } })
}

export async function readFileApi(path: string): Promise<ReadFileResponse> {
  return request.get('/files/read', { params: { path } })
}

export async function writeFileApi(path: string, content: string) {
  return request.post('/files/write', { path, content })
}

export async function deleteFileApi(path: string) {
  return request.delete('/files/delete', { params: { path } })
}

export async function createDirectoryApi(path: string) {
  return request.post('/files/mkdir', { path })
}

export async function changePermissionsApi(path: string, permissions: string) {
  return request.post('/files/chmod', { path, permissions })
}

export interface Website {
  id: string
  name: string
  domain: string
  web_server: string
  config_path: string
  ssl_enabled: boolean
  status: string
  created_at: string
}

export async function getWebsitesApi(): Promise<Website[]> {
  return request.get('/websites')
}

export async function getWebsiteApi(id: string) {
  return request.get(`/websites/${id}`)
}

export async function createWebsiteApi(data: { name: string; domain: string; web_server: string; root_path: string }) {
  return request.post('/websites', data)
}

export async function updateWebsiteApi(id: string, data: Partial<{ name: string; domain: string; ssl_enabled: boolean }>) {
  return request.put(`/websites/${id}`, data)
}

export async function deleteWebsiteApi(id: string) {
  return request.delete(`/websites/${id}`)
}

export async function enableSSLApi(id: string) {
  return request.post(`/websites/${id}/enable-ssl`)
}

export interface Database {
  id: string
  name: string
  type: string
  host: string
  port: number
  username: string
  status: string
  created_at: string
}

export interface Backup {
  id: string
  type: string
  path: string
  size: number
  status: string
  created_at: string
}

export async function getDatabasesApi(): Promise<Database[]> {
  return request.get('/databases')
}

export async function getDatabaseApi(id: string) {
  return request.get(`/databases/${id}`)
}

export async function createDatabaseApi(data: { name: string; type: string; username: string; password: string }) {
  return request.post('/databases', data)
}

export async function deleteDatabaseApi(id: string) {
  return request.delete(`/databases/${id}`)
}

export async function backupDatabaseApi(id: string) {
  return request.post(`/databases/${id}/backup`)
}

export async function getBackupsApi(id: string): Promise<Backup[]> {
  return request.get(`/databases/${id}/backups`)
}

export interface Image {
  id: string
  name: string
  tag: string
  size: number
  created_at: string
}

export interface Container {
  id: string
  name: string
  image: string
  status: string
  ports: string[]
  created_at: string
}

export interface ContainerLogsResponse {
  logs: string
}

export async function getImagesApi(): Promise<Image[]> {
  return request.get('/containers/images')
}

export async function pullImageApi(imageName: string) {
  return request.post('/containers/images/pull', { imageName })
}

export async function removeImageApi(id: string) {
  return request.delete(`/containers/images/${id}`)
}

export async function getContainersApi(all?: boolean): Promise<Container[]> {
  return request.get('/containers', { params: { all } })
}

export async function createContainerApi(data: { image: string; name: string; ports?: string[]; env?: string[]; command?: string }) {
  return request.post('/containers', data)
}

export async function startContainerApi(id: string) {
  return request.post(`/containers/${id}/start`)
}

export async function stopContainerApi(id: string) {
  return request.post(`/containers/${id}/stop`)
}

export async function removeContainerApi(id: string) {
  return request.delete(`/containers/${id}`)
}

export async function getContainerLogsApi(id: string, tail?: number): Promise<ContainerLogsResponse> {
  return request.get(`/containers/${id}/logs`, { params: { tail } })
}

export interface Task {
  id: string
  name: string
  type: string
  cron_expression: string
  command?: string
  status: string
  last_run_at?: string
  created_at: string
  updated_at: string
}

export interface TaskExecution {
  id: string
  status: string
  output?: string
  error?: string
  started_at: string
  finished_at?: string
}

export async function getTasksApi(): Promise<Task[]> {
  return request.get('/tasks')
}

export interface DockerStatus {
  installed: boolean
  version?: string
  running: boolean
  composeInstalled: boolean
  composeVersion?: string
}

export interface ServiceStatus {
  name: string
  installed: boolean
  version?: string
  running: boolean
}

export interface SystemServices {
  docker: DockerStatus
  nginx: ServiceStatus
  apache: ServiceStatus
  php: ServiceStatus
  mysql: ServiceStatus
}

export async function getDockerStatusApi(): Promise<DockerStatus> {
  return request.get('/system/docker/status')
}

export async function getServicesStatusApi(): Promise<SystemServices> {
  return request.get('/system/services')
}

export async function installDockerApi() {
  return request.post('/system/docker/install')
}

export async function installDockerComposeApi() {
  return request.post('/system/docker/compose/install')
}

export async function installNginxApi() {
  return request.post('/system/nginx/install')
}

export async function installApacheApi() {
  return request.post('/system/apache/install')
}

export async function installPHPApi(version?: string) {
  return request.post('/system/php/install', { version })
}

export async function installMySQLApi() {
  return request.post('/system/mysql/install')
}

export async function getTaskApi(id: string) {
  return request.get(`/tasks/${id}`)
}

export async function createTaskApi(data: { name: string; type: string; cron_expression: string; command?: string }) {
  return request.post('/tasks', data)
}

export async function updateTaskApi(id: string, data: Partial<{ name: string; cron_expression: string; command?: string; status: string }>) {
  return request.put(`/tasks/${id}`, data)
}

export async function deleteTaskApi(id: string) {
  return request.delete(`/tasks/${id}`)
}

export async function runTaskApi(id: string) {
  return request.post(`/tasks/${id}/run`)
}

export async function getTaskExecutionsApi(id: string): Promise<TaskExecution[]> {
  return request.get(`/tasks/${id}/executions`)
}
