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

export async function searchFilesApi(keyword: string, path?: string, includeSubdirs?: boolean): Promise<FileItem[]> {
  return request.get('/files/search', { params: { keyword, path, includeSubdirs } })
}

export async function downloadFileApi(path: string) {
  return request.get('/files/download', { params: { path }, responseType: 'blob' })
}

export async function uploadFileApi(file: File, path?: string, relativePath?: string) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/files/upload', formData, { params: { path, relativePath }, headers: { 'Content-Type': 'multipart/form-data' } })
}

export async function renameFileApi(path: string, newName: string) {
  return request.post('/files/rename', { path, newName })
}

export async function compressFileApi(path: string) {
  return request.post('/files/compress', { path })
}

export async function compressFilesApi(paths: string[]) {
  return request.post('/files/compress', { paths })
}

export async function extractFileApi(path: string) {
  return request.post('/files/extract', { path })
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

export interface DirectoryItem {
  name: string
  type: 'file' | 'directory'
  path: string
}

export async function listDirectoryApi(path: string): Promise<DirectoryItem[]> {
  return request.get('/containers/compose/directory', { params: { path } })
}

export async function readComposeFileApi(path: string): Promise<{ content: string }> {
  return request.get('/containers/compose/file', { params: { path } })
}

export async function composeUpApi(data: { path?: string; content?: string }) {
  return request.post('/containers/compose/up', data)
}

export async function composeUpStreamApi(data: { path?: string; content?: string }, onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/containers/compose/up', data as unknown as Record<string, unknown>, onLog)
}

export async function composeDownApi(path: string) {
  return request.post('/containers/compose/down', { path })
}

export async function composeLogsApi(path: string): Promise<{ logs: string }> {
  return request.get('/containers/compose/logs', { params: { path } })
}

export async function getComposeServicesApi(path: string): Promise<Array<{ name: string; state: string; ports: string; image: string }>> {
  return request.get('/containers/compose/services', { params: { path } })
}

export async function composeBuildApi(path: string) {
  return request.post('/containers/compose/build', { path })
}

export async function composePullApi(path: string) {
  return request.post('/containers/compose/pull', { path })
}

export async function composeRestartApi(path: string) {
  return request.post('/containers/compose/restart', { path })
}

export async function composeDownWithVolumesApi(path: string) {
  return request.post('/containers/compose/down-v', { path })
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

export type DockerMirror = 'official' | 'aliyun' | 'daocloud'

export interface InstallationResult {
  success: boolean
  message: string
  logs: string[]
}

export interface SseEvent {
  log?: string
  done?: boolean
  success?: boolean
  message?: string
}

export async function getDockerStatusApi(): Promise<DockerStatus> {
  return request.get('/system/docker/status')
}

export async function startDockerApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/docker/start', {}, onLog)
}

export async function startNginxApi() {
  return request.post('/system/nginx/start')
}

export async function startApacheApi() {
  return request.post('/system/apache/start')
}

export async function startPHPApi() {
  return request.post('/system/php/start')
}

export async function startMySQLApi() {
  return request.post('/system/mysql/start')
}

export async function stopDockerApi() {
  return request.post('/system/docker/stop')
}

export async function stopNginxApi() {
  return request.post('/system/nginx/stop')
}

export async function stopApacheApi() {
  return request.post('/system/apache/stop')
}

export async function stopPHPApi() {
  return request.post('/system/php/stop')
}

export async function stopMySQLApi() {
  return request.post('/system/mysql/stop')
}

export async function uninstallDockerApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/docker/uninstall', {}, onLog)
}

export async function uninstallNginxApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/nginx/uninstall', {}, onLog)
}

export async function uninstallApacheApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/apache/uninstall', {}, onLog)
}

export async function uninstallPHPApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/php/uninstall', {}, onLog)
}

export async function uninstallMySQLApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/mysql/uninstall', {}, onLog)
}

export async function getDockerConfigApi(): Promise<{ content: string }> {
  return request.get('/system/docker/config')
}

export async function saveDockerConfigApi(content: string) {
  return request.post('/system/docker/config', { content })
}

export async function getNginxConfigApi(): Promise<{ content: string }> {
  return request.get('/system/nginx/config')
}

export async function saveNginxConfigApi(content: string) {
  return request.post('/system/nginx/config', { content })
}

export async function getApacheConfigApi(): Promise<{ content: string }> {
  return request.get('/system/apache/config')
}

export async function saveApacheConfigApi(content: string) {
  return request.post('/system/apache/config', { content })
}

export async function getPHPConfigApi(): Promise<{ content: string }> {
  return request.get('/system/php/config')
}

export async function savePHPConfigApi(content: string) {
  return request.post('/system/php/config', { content })
}

export async function getMySQLConfigApi(): Promise<{ content: string }> {
  return request.get('/system/mysql/config')
}

export async function saveMySQLConfigApi(content: string) {
  return request.post('/system/mysql/config', { content })
}

export async function getServicesStatusApi(): Promise<SystemServices> {
  return request.get('/system/services')
}

export async function installDockerApi(mirror?: DockerMirror, onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/docker/install', { mirror }, onLog)
}

export async function installDockerComposeApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/docker/compose/install', {}, onLog)
}

export async function installNginxApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/nginx/install', {}, onLog)
}

export async function installApacheApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/apache/install', {}, onLog)
}

export async function installPHPApi(version?: string, onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/php/install', { version }, onLog)
}

export async function installMySQLApi(onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return makeSseRequest('/system/mysql/install', {}, onLog)
}

function makeSseRequest(url: string, body: Record<string, unknown>, onLog?: (log: string) => void): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const token = localStorage.getItem('access_token')
    const fullUrl = `/api${url}`
    let resolved = false
    let lastProcessedIndex = 0
    
    const xhr = new XMLHttpRequest()
    xhr.open('POST', fullUrl, true)
    xhr.setRequestHeader('Content-Type', 'application/json')
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        const responseText = xhr.responseText
        const newData = responseText.substring(lastProcessedIndex)
        
        if (newData) {
          const lines = newData.split('\n')
          let currentEvent = ''
          
          for (const line of lines) {
            if (line.trim() === '') {
              if (currentEvent.startsWith('data: ')) {
                try {
                  const data = JSON.parse(currentEvent.substring(6)) as SseEvent
                  if (data.done !== undefined && !resolved) {
                    resolved = true
                    resolve({ success: data.success || false, message: data.message || '' })
                  } else if (data.log) {
                    onLog?.(data.log)
                  }
                } catch (e) {
                  console.error('解析 SSE 数据失败', e)
                }
              }
              currentEvent = ''
            } else if (line.startsWith('data: ')) {
              currentEvent = line
            }
          }
          
          lastProcessedIndex = responseText.length
        }
      }
      
      if (xhr.readyState === 4 && !resolved) {
        if (xhr.status === 200) {
          resolve({ success: true, message: '安装完成' })
        } else {
          resolve({ success: false, message: '安装失败' })
        }
      }
    }
    
    xhr.onerror = () => {
      if (!resolved) {
        resolve({ success: false, message: '网络错误' })
      }
    }
    
    xhr.send(JSON.stringify(body))
  })
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
