<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getImagesApi, pullImageApi, removeImageApi, getContainersApi, createContainerApi, startContainerApi, stopContainerApi, removeContainerApi, getContainerLogsApi, composeUpStreamApi, composeDownApi, composeLogsApi, listDirectoryApi, getComposeServicesApi, composeRestartApi, composeDownWithVolumesApi, getDockerStatusApi, uploadFileApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElTabs, ElTabPane, ElSelect, ElOption } from 'element-plus'

interface Image {
  id: string
  name: string
  tag: string
  size: number
  created_at: string
}

interface Container {
  id: string
  name: string
  image: string
  status: string
  ports: string[]
  created_at: string
}

const activeTab = ref('containers')
const images = ref<Image[]>([])
const containers = ref<Container[]>([])
const showPullDialog = ref(false)
const showCreateDialog = ref(false)
const showLogsDialog = ref(false)
const imageName = ref('')
const selectedContainer = ref<Container | null>(null)
const containerLogs = ref('')
const form = ref({
  image: '',
  name: '',
  ports: '',
  env: '',
  command: ''
})

const composeContent = ref(`version: '3.8'
services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    restart: always`)
const composeLogs = ref('')
const showComposeLogs = ref(false)

const selectedComposePath = ref('')

const composeServices = ref<Array<{ name: string; state: string; ports: string; image: string }>>([])
const showServicesDialog = ref(false)

const dockerStatus = ref<{ installed: boolean; running: boolean } | null>(null)
const showDockerInstallDialog = ref(false)

const showFileDeployDialog = ref(false)
const deployMode = ref<'upload' | 'path'>('upload')
const deployFilePath = ref('')
const selectedDeployFile = ref<File | null>(null)
const deployLoading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const browserCurrentPath = ref('/')
const browserItems = ref<Array<{ name: string; type: 'file' | 'directory'; path: string }>>([])
const browserPathHistory = ref<string[]>([])
const browserLoading = ref(false)

const showDeployLogDialog = ref(false)
const deployLogs = ref('')
const deploying = ref(false)
const deploySuccess = ref(false)
const deployLogContent = ref<HTMLElement | null>(null)

const router = useRouter()

interface ComposeProject {
  name: string
  path: string
  status: 'running' | 'stopped' | 'partial'
  services: number
  runningServices: number
  createTime: string
}

interface ComposeTemplate {
  name: string
  icon: string
  description: string
  compose: string
}

interface ServiceConfig {
  name: string
  image: string
  ports: string[]
  env: { key: string; value: string }[]
  volumes: string[]
  restart: 'always' | 'no' | 'on-failure' | 'unless-stopped'
  command: string
}

interface ComposeForm {
  projectName: string
  projectPath: string
  services: ServiceConfig[]
}

const composeProjects = ref<ComposeProject[]>([])
const showCreateProjectDialog = ref(false)
const showDeployDialog = ref(false)

const composeForm = ref<ComposeForm>({
  projectName: '',
  projectPath: '/opt',
  services: [{
    name: '',
    image: '',
    ports: [],
    env: [{ key: '', value: '' }],
    volumes: [],
    restart: 'always',
    command: ''
  }]
})

const quickTemplates: ComposeTemplate[] = [
  {
    name: 'Nginx',
    icon: 'el-icon-collection',
    description: '高性能 Web 服务器',
    compose: `version: '3.8'
services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./html:/usr/share/nginx/html
    restart: always`
  },
  {
    name: 'MySQL',
    icon: 'el-icon-s-data',
    description: '关系型数据库',
    compose: `version: '3.8'
services:
  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: root
    volumes:
      - ./data:/var/lib/mysql
    restart: always`
  },
  {
    name: 'Redis',
    icon: 'el-icon-s-tools',
    description: '高性能缓存数据库',
    compose: `version: '3.8'
services:
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
    volumes:
      - ./data:/data
    restart: always`
  },
  {
    name: 'WordPress',
    icon: 'el-icon-document',
    description: '博客内容管理系统',
    compose: `version: '3.8'
services:
  wordpress:
    image: wordpress:latest
    ports:
      - "8080:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
      WORDPRESS_DB_NAME: wordpress
    volumes:
      - ./wp-content:/var/www/html/wp-content
    depends_on:
      - db
    restart: always
  db:
    image: mysql:5.7
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress
    volumes:
      - ./mysql:/var/lib/mysql
    restart: always`
  },
  {
    name: 'Node.js',
    icon: 'el-icon-s-promotion',
    description: 'Node.js 应用运行环境',
    compose: `version: '3.8'
services:
  node:
    image: node:latest
    ports:
      - "3000:3000"
    volumes:
      - ./app:/app
    working_dir: /app
    command: npm start
    restart: always`
  },
  {
    name: 'PostgreSQL',
    icon: 'el-icon-s-data',
    description: '开源关系型数据库',
    compose: `version: '3.8'
services:
  postgres:
    image: postgres:latest
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
    volumes:
      - ./data:/var/lib/postgresql/data
    restart: always`
  }
]

const selectedTemplate = ref<ComposeTemplate | null>(null)

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function loadImages() {
  try {
    images.value = await getImagesApi()
  } catch {
    ElMessage.error('加载镜像列表失败')
  }
}

async function loadContainers() {
  try {
    containers.value = await getContainersApi(true)
  } catch {
    ElMessage.error('加载容器列表失败')
  }
}

async function pullImage() {
  if (!imageName.value) {
    ElMessage.warning('请输入镜像名称')
    return
  }
  try {
    await pullImageApi(imageName.value)
    ElMessage.success('镜像拉取成功')
    showPullDialog.value = false
    imageName.value = ''
    loadImages()
  } catch {
    ElMessage.error('镜像拉取失败')
  }
}

async function removeImage(id: string) {
  try {
    await removeImageApi(id)
    ElMessage.success('删除成功')
    loadImages()
  } catch {
    ElMessage.error('删除失败')
  }
}

async function createContainer() {
  if (!form.value.image || !form.value.name) {
    ElMessage.warning('请填写完整信息')
    return
  }
  const data = {
    image: form.value.image,
    name: form.value.name,
    ports: form.value.ports.split(',').filter(p => p.trim()),
    env: form.value.env.split(',').filter(e => e.trim()),
    command: form.value.command || undefined
  }
  try {
    await createContainerApi(data)
    ElMessage.success('容器创建成功')
    showCreateDialog.value = false
    form.value = { image: '', name: '', ports: '', env: '', command: '' }
    loadContainers()
  } catch {
    ElMessage.error('容器创建失败')
  }
}

async function startContainer(id: string) {
  try {
    await startContainerApi(id)
    ElMessage.success('容器启动成功')
    loadContainers()
  } catch {
    ElMessage.error('容器启动失败')
  }
}

async function stopContainer(id: string) {
  try {
    await stopContainerApi(id)
    ElMessage.success('容器停止成功')
    loadContainers()
  } catch {
    ElMessage.error('容器停止失败')
  }
}

async function removeContainer(id: string) {
  try {
    await removeContainerApi(id)
    ElMessage.success('容器删除成功')
    loadContainers()
  } catch {
    ElMessage.error('容器删除失败')
  }
}

async function viewLogs(container: Container) {
  selectedContainer.value = container
  try {
    const result = await getContainerLogsApi(container.id, 100)
    containerLogs.value = result.logs || ''
  } catch {
    containerLogs.value = '获取日志失败'
  }
  showLogsDialog.value = true
}

function getErrorMessage(error: any): string {
  if (error.response?.data?.message) {
    return error.response.data.message
  } else if (error.message) {
    return error.message
  }
  return '操作失败'
}

function getErrorDetail(error: any): string | undefined {
  return error.response?.data?.detail
}

async function deployWithLogs(data: { path?: string; content?: string }): Promise<{ success: boolean; message: string }> {
  showDeployLogDialog.value = true
  deploying.value = true
  deploySuccess.value = false
  deployLogs.value = ''
  await nextTick()

  const appendLog = (log: string) => {
    deployLogs.value += log
    nextTick(() => {
      if (deployLogContent.value) {
        deployLogContent.value.scrollTop = deployLogContent.value.scrollHeight
      }
    })
  }

  try {
    const result = await composeUpStreamApi(data, appendLog)
    deploySuccess.value = result.success
    if (!result.success && result.message) {
      appendLog(`\n[错误] ${result.message}\n`)
    } else if (result.success && result.message) {
      appendLog(`\n[完成] ${result.message}\n`)
    }
    return result
  } catch (error: any) {
    deploySuccess.value = false
    const message = getErrorMessage(error)
    appendLog(`\n[错误] ${message}\n`)
    return { success: false, message }
  } finally {
    deploying.value = false
  }
}

async function loadComposeServices(path: string) {
  try {
    composeServices.value = await getComposeServicesApi(path)
  } catch {
    composeServices.value = []
  }
}

async function viewComposeLogs() {
  if (selectedComposePath.value) {
    try {
      const result = await composeLogsApi(selectedComposePath.value)
      composeLogs.value = result.logs || ''
    } catch (error: any) {
      composeLogs.value = `获取日志失败: ${getErrorMessage(error)}`
    }
    showComposeLogs.value = true
  } else {
    ElMessage.warning('请选择文件')
  }
}

async function viewServices() {
  if (selectedComposePath.value) {
    await loadComposeServices(selectedComposePath.value)
    showServicesDialog.value = true
  } else {
    ElMessage.warning('请选择文件')
  }
}

async function loadComposeProjects() {
  try {
    const items = await listDirectoryApi('/opt')
    const composeDirs = items.filter(item => item.type === 'directory')
    const projects: ComposeProject[] = []
    
    for (const dir of composeDirs) {
      try {
        const files = await listDirectoryApi(dir.path)
        const composeFile = files.find(f => f.name === 'docker-compose.yml' || f.name === 'docker-compose.yaml')
        if (composeFile) {
          let services = 0
          let runningServices = 0
          let status: 'running' | 'stopped' | 'partial' = 'stopped'
          
          try {
            const serviceList = await getComposeServicesApi(composeFile.path)
            services = serviceList.length
            runningServices = serviceList.filter(s => s.state.toLowerCase().includes('running')).length
            status = runningServices === services ? 'running' : runningServices > 0 ? 'partial' : 'stopped'
          } catch {
            status = 'stopped'
          }
          
          projects.push({
            name: dir.name,
            path: composeFile.path,
            status,
            services,
            runningServices,
            createTime: new Date().toLocaleString()
          })
        }
      } catch {
        continue
      }
    }
    
    composeProjects.value = projects
  } catch {
    composeProjects.value = []
  }
}

async function deployFromTemplate(template: ComposeTemplate) {
  selectedTemplate.value = template
  composeContent.value = template.compose

  const result = await deployWithLogs({ content: template.compose })
  if (result.success) {
    ElMessage.success(`${template.name} 部署成功`)
    loadComposeProjects()
    loadContainers()
  } else {
    ElMessage.error(result.message || '部署失败')
  }
}

async function confirmDeploy() {
  if (!composeContent.value.trim()) {
    ElMessage.warning('请输入 Compose 配置内容')
    return
  }
  const result = await deployWithLogs({ content: composeContent.value })
  if (result.success) {
    ElMessage.success('部署成功')
    showDeployDialog.value = false
    loadComposeProjects()
    loadContainers()
  } else {
    ElMessage.error(result.message || '部署失败')
  }
}

function openFileDeploy() {
  deployMode.value = 'upload'
  deployFilePath.value = ''
  selectedDeployFile.value = null
  showFileDeployDialog.value = true
}

async function browseTo(path: string) {
  browserLoading.value = true
  try {
    const items = await listDirectoryApi(path)
    const dirs = items.filter(item => item.type === 'directory')
    const files = items.filter(item => 
      item.type === 'file' && 
      (item.name === 'docker-compose.yml' || item.name === 'docker-compose.yaml' || item.name.endsWith('.yml') || item.name.endsWith('.yaml'))
    )
    browserItems.value = [...dirs, ...files]
    if (browserCurrentPath.value !== path) {
      browserPathHistory.value.push(browserCurrentPath.value)
    }
    browserCurrentPath.value = path
  } catch (error: any) {
    ElMessage.error(`读取目录失败: ${getErrorMessage(error)}`)
  } finally {
    browserLoading.value = false
  }
}

function browseBack() {
  if (browserPathHistory.value.length > 0) {
    const prevPath = browserPathHistory.value.pop()!
    browserLoading.value = true
    listDirectoryApi(prevPath).then(items => {
      const dirs = items.filter(item => item.type === 'directory')
      const files = items.filter(item => 
        item.type === 'file' && 
        (item.name === 'docker-compose.yml' || item.name === 'docker-compose.yaml' || item.name.endsWith('.yml') || item.name.endsWith('.yaml'))
      )
      browserItems.value = [...dirs, ...files]
      browserCurrentPath.value = prevPath
    }).catch((error: any) => {
      ElMessage.error(`读取目录失败: ${getErrorMessage(error)}`)
    }).finally(() => {
      browserLoading.value = false
    })
  }
}

function browseUp() {
  const current = browserCurrentPath.value
  if (current === '/' || current === '') return
  const parts = current.split('/').filter(Boolean)
  parts.pop()
  const parentPath = parts.length === 0 ? '/' : '/' + parts.join('/')
  browseTo(parentPath)
}

function selectBrowserItem(item: { name: string; type: 'file' | 'directory'; path: string }) {
  if (item.type === 'directory') {
    browseTo(item.path)
  } else {
    deployFilePath.value = item.path
  }
}

function switchToPathMode() {
  deployMode.value = 'path'
  deployFilePath.value = ''
  if (browserItems.value.length === 0) {
    browseTo('/')
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.yml') && !fileName.endsWith('.yaml')) {
      ElMessage.warning('请选择 .yml 或 .yaml 格式的文件')
      target.value = ''
      return
    }
    selectedDeployFile.value = file
  }
}

async function confirmFileDeploy() {
  if (deployMode.value === 'upload') {
    if (!selectedDeployFile.value) {
      ElMessage.warning('请选择 docker-compose.yml 文件')
      return
    }
    deployLoading.value = true
    try {
      const uploadPath = '/tmp'
      const uploadResult = await uploadFileApi(selectedDeployFile.value, uploadPath)
      const filePath = (uploadResult as any).path || `${uploadPath}/${selectedDeployFile.value.name}`
      const result = await deployWithLogs({ path: filePath })
      if (result.success) {
        ElMessage.success('部署成功')
        showFileDeployDialog.value = false
        loadComposeProjects()
        loadContainers()
      } else {
        ElMessage.error(result.message || '部署失败')
      }
    } catch (error: any) {
      const message = getErrorMessage(error)
      ElMessage.error(message)
    } finally {
      deployLoading.value = false
    }
  } else {
    if (!deployFilePath.value.trim()) {
      ElMessage.warning('请输入 docker-compose.yml 文件路径')
      return
    }
    deployLoading.value = true
    try {
      const result = await deployWithLogs({ path: deployFilePath.value.trim() })
      if (result.success) {
        ElMessage.success('部署成功')
        showFileDeployDialog.value = false
        loadComposeProjects()
        loadContainers()
      } else {
        ElMessage.error(result.message || '部署失败')
      }
    } catch (error: any) {
      const message = getErrorMessage(error)
      ElMessage.error(message)
    } finally {
      deployLoading.value = false
    }
  }
}

function openCreateProject() {
  composeForm.value = {
    projectName: '',
    projectPath: '/opt',
    services: [{
      name: '',
      image: '',
      ports: [],
      env: [{ key: '', value: '' }],
      volumes: [],
      restart: 'always',
      command: ''
    }]
  }
  showCreateProjectDialog.value = true
}

function addService() {
  composeForm.value.services.push({
    name: '',
    image: '',
    ports: [],
    env: [{ key: '', value: '' }],
    volumes: [],
    restart: 'always',
    command: ''
  })
}

function removeService(index: number) {
  if (composeForm.value.services.length > 1) {
    composeForm.value.services.splice(index, 1)
  }
}

function addEnv(service: ServiceConfig) {
  service.env.push({ key: '', value: '' })
}

function removeEnv(service: ServiceConfig, index: number) {
  if (service.env.length > 1) {
    service.env.splice(index, 1)
  }
}

function addPort(service: ServiceConfig) {
  service.ports.push('')
}

function removePort(service: ServiceConfig, index: number) {
  service.ports.splice(index, 1)
}

function addVolume(service: ServiceConfig) {
  service.volumes.push('')
}

function removeVolume(service: ServiceConfig, index: number) {
  service.volumes.splice(index, 1)
}

function generateComposeYaml(): string {
  const services: Record<string, any> = {}
  
  composeForm.value.services.forEach(service => {
    if (!service.name || !service.image) return
    
    const serviceConfig: Record<string, any> = {
      image: service.image,
      restart: service.restart
    }
    
    if (service.ports && service.ports.length > 0) {
      serviceConfig.ports = service.ports.filter((p: string) => p.trim()).map((p: string) => `"${p.trim()}"`)
    }
    
    if (service.env && service.env.length > 0) {
      const envMap: Record<string, string> = {}
      service.env.forEach(e => {
        if (e.key) envMap[e.key] = e.value || ''
      })
      serviceConfig.environment = envMap
    }
    
    if (service.volumes && service.volumes.length > 0) {
      serviceConfig.volumes = service.volumes.filter((v: string) => v.trim()).map((v: string) => `"${v.trim()}"`)
    }
    
    if (service.command) {
      serviceConfig.command = service.command
    }
    
    services[service.name] = serviceConfig
  })
  
  return `version: '3.8'\nservices:\n` + 
    Object.entries(services).map(([name, config]) => {
      let configStr = `  ${name}:\n`
      for (const [key, value] of Object.entries(config)) {
        if (Array.isArray(value)) {
          configStr += `    ${key}:\n`
          value.forEach((item: string) => {
            configStr += `      - ${item}\n`
          })
        } else if (typeof value === 'object' && value !== null) {
          configStr += `    ${key}:\n`
          for (const [k, v] of Object.entries(value)) {
            configStr += `      ${k}: ${v}\n`
          }
        } else {
          configStr += `    ${key}: ${value}\n`
        }
      }
      return configStr
    }).join('')
}

async function createProject() {
  if (!composeForm.value.projectName) {
    ElMessage.warning('请输入项目名称')
    return
  }

  const validServices = composeForm.value.services.filter(s => s.name && s.image)
  if (validServices.length === 0) {
    ElMessage.warning('请至少配置一个服务')
    return
  }

  const yaml = generateComposeYaml()

  const result = await deployWithLogs({ content: yaml })
  if (result.success) {
    ElMessage.success('项目创建成功')
    showCreateProjectDialog.value = false
    loadComposeProjects()
    loadContainers()
  } else {
    ElMessage.error(result.message || '项目创建失败')
  }
}

async function startProject(project: ComposeProject) {
  const result = await deployWithLogs({ path: project.path })
  if (result.success) {
    ElMessage.success(`项目 ${project.name} 启动成功`)
    await loadComposeProjects()
    loadContainers()
  } else {
    ElMessage.error(result.message || `项目 ${project.name} 启动失败`)
  }
}

async function stopProject(project: ComposeProject) {
  try {
    await composeDownApi(project.path)
    ElMessage.success(`项目 ${project.name} 已停止`)
    await loadComposeProjects()
    loadContainers()
  } catch (error: any) {
    const message = getErrorMessage(error)
    const detail = getErrorDetail(error)
    if (detail) {
      ElMessage.error(`${message}\n详细信息: ${detail}`)
    } else {
      ElMessage.error(message)
    }
  }
}

async function restartProject(project: ComposeProject) {
  try {
    await composeRestartApi(project.path)
    ElMessage.success(`项目 ${project.name} 已重启`)
    await loadComposeProjects()
    loadContainers()
  } catch (error: any) {
    const message = getErrorMessage(error)
    const detail = getErrorDetail(error)
    if (detail) {
      ElMessage.error(`${message}\n详细信息: ${detail}`)
    } else {
      ElMessage.error(message)
    }
  }
}

async function deleteProject(project: ComposeProject) {
  try {
    await composeDownWithVolumesApi(project.path)
    ElMessage.success(`项目 ${project.name} 已删除`)
    await loadComposeProjects()
    loadContainers()
  } catch (error: any) {
    const message = getErrorMessage(error)
    const detail = getErrorDetail(error)
    if (detail) {
      ElMessage.error(`${message}\n详细信息: ${detail}`)
    } else {
      ElMessage.error(message)
    }
  }
}

async function viewProjectLogs(project: ComposeProject) {
  selectedComposePath.value = project.path
  await viewComposeLogs()
}

async function viewProjectServices(project: ComposeProject) {
  selectedComposePath.value = project.path
  await viewServices()
}

async function checkDockerStatus() {
  try {
    dockerStatus.value = await getDockerStatusApi()
    if (!dockerStatus.value.installed) {
      showDockerInstallDialog.value = true
    }
  } catch (error: any) {
    const message = error.response?.data?.message || error.message || '获取 Docker 状态失败'
    ElMessage.error(message)
  }
}

function goToSystemPage() {
  showDockerInstallDialog.value = false
  router.push('/system')
}

onMounted(() => {
  checkDockerStatus()
  loadImages()
  loadContainers()
})

watch(activeTab, (newVal) => {
  if (newVal === 'compose') {
    loadComposeProjects()
  }
})
</script>

<template>
  <div class="containers-page">
    <div class="page-header">
      <h2>容器管理</h2>
    </div>
    
    <ElTabs v-model="activeTab" class="tabs">
      <ElTabPane label="容器" name="containers">
        <div class="tab-content">
          <button class="create-btn" @click="showCreateDialog = true">
            <i class="el-icon-plus"></i>
            创建容器
          </button>
          
          <div class="containers-table">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>镜像</th>
                  <th>状态</th>
                  <th>端口</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="container in containers" :key="container.id">
                  <td>{{ container.name }}</td>
                  <td>{{ container.image }}</td>
                  <td>
                    <span class="status-tag" :class="container.status === 'running' ? 'success' : container.status === 'exited' ? 'error' : 'warning'">
                      {{ container.status === 'running' ? '运行中' : container.status === 'exited' ? '已退出' : '创建' }}
                    </span>
                  </td>
                  <td>{{ container.ports.join(', ') || '-' }}</td>
                  <td>{{ new Date(container.created_at).toLocaleString() }}</td>
                  <td>
                    <div class="actions">
                      <button class="action-btn" @click="viewLogs(container)">
                        <i class="el-icon-view"></i>
                        日志
                      </button>
                      <button v-if="container.status !== 'running'" class="action-btn start-btn" @click="startContainer(container.id)">
                        <i class="el-icon-play"></i>
                        启动
                      </button>
                      <button v-else class="action-btn stop-btn" @click="stopContainer(container.id)">
                        <i class="el-icon-pause"></i>
                        停止
                      </button>
                      <button class="action-btn delete-btn" @click="removeContainer(container.id)">
                        <i class="el-icon-delete"></i>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <div v-if="containers.length === 0" class="empty-state">
              <i class="el-icon-s-grid"></i>
              <p>暂无容器</p>
              <button @click="showCreateDialog = true">创建第一个容器</button>
            </div>
          </div>
        </div>
      </ElTabPane>
      
      <ElTabPane label="镜像" name="images">
        <div class="tab-content">
          <button class="create-btn" @click="showPullDialog = true">
            <i class="el-icon-download"></i>
            拉取镜像
          </button>
          
          <div class="images-grid">
            <div v-for="image in images" :key="image.id" class="image-card">
              <div class="image-info">
                <div class="image-name">{{ image.name }}:{{ image.tag }}</div>
                <div class="image-meta">
                  <span>{{ formatBytes(image.size) }}</span>
                  <span>{{ new Date(image.created_at).toLocaleDateString() }}</span>
                </div>
              </div>
              <button class="delete-btn" @click="removeImage(image.id)">
                <i class="el-icon-delete"></i>
              </button>
            </div>
            
            <div v-if="images.length === 0" class="empty-state">
              <i class="el-icon-s-grid"></i>
              <p>暂无镜像</p>
              <button @click="showPullDialog = true">拉取镜像</button>
            </div>
          </div>
        </div>
      </ElTabPane>
      
      <ElTabPane label="容器编排" name="compose">
        <div class="tab-content">
          <div class="compose-header">
            <button class="create-btn" @click="openCreateProject">
              <i class="el-icon-plus"></i>
              创建项目
            </button>
            <button class="create-btn" @click="openFileDeploy">
              <i class="el-icon-upload2"></i>
              从文件部署
            </button>
            <button class="create-btn" @click="showDeployDialog = true">
              <i class="el-icon-edit"></i>
              编辑部署
            </button>
          </div>
          
          <div class="quick-templates">
            <h3 class="template-title">快速部署</h3>
            <div class="template-grid">
              <div 
                v-for="template in quickTemplates" 
                :key="template.name"
                class="template-card"
                @click="deployFromTemplate(template)"
              >
                <i :class="template.icon" class="template-icon"></i>
                <div class="template-name">{{ template.name }}</div>
                <div class="template-desc">{{ template.description }}</div>
                <button class="deploy-btn">一键启动</button>
              </div>
            </div>
          </div>
          
          <div class="projects-section">
            <h3 class="section-title">项目列表</h3>
            <div class="projects-table">
              <table>
                <thead>
                  <tr>
                    <th>项目名称</th>
                    <th>状态</th>
                    <th>服务数量</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="project in composeProjects" :key="project.name">
                    <td>
                      <div class="project-name">{{ project.name }}</div>
                      <div class="project-path">{{ project.path }}</div>
                    </td>
                    <td>
                      <span class="status-tag" :class="project.status">
                        {{ project.status === 'running' ? '运行中' : project.status === 'partial' ? '部分运行' : '已停止' }}
                      </span>
                      <span v-if="project.services > 0" class="services-count">
                        {{ project.runningServices }}/{{ project.services }}
                      </span>
                    </td>
                    <td>{{ project.services }}</td>
                    <td>
                      <div class="project-actions">
                        <button 
                          class="action-btn" 
                          @click="project.status === 'running' ? stopProject(project) : startProject(project)"
                        >
                          <i :class="project.status === 'running' ? 'el-icon-pause' : 'el-icon-play'"></i>
                          {{ project.status === 'running' ? '停止' : '启动' }}
                        </button>
                        <button class="action-btn" @click="restartProject(project)">
                          <i class="el-icon-refresh"></i>
                          重启
                        </button>
                        <button class="action-btn" @click="viewProjectServices(project)">
                          <i class="el-icon-menu"></i>
                          服务
                        </button>
                        <button class="action-btn" @click="viewProjectLogs(project)">
                          <i class="el-icon-view"></i>
                          日志
                        </button>
                        <button class="action-btn delete-btn" @click="deleteProject(project)">
                          <i class="el-icon-delete"></i>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="composeProjects.length === 0" class="empty-state">
                <i class="el-icon-s-grid"></i>
                <p>暂无编排项目</p>
                <button @click="openCreateProject">创建第一个项目</button>
              </div>
            </div>
          </div>
        </div>
      </ElTabPane>
    </ElTabs>
    
    <ElDialog v-model="showPullDialog" title="拉取镜像" @close="imageName = ''">
      <ElForm :model="{ name: imageName }" label-width="80px">
        <ElFormItem label="镜像名称">
          <ElInput v-model="imageName" placeholder="如: nginx:latest" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button class="el-button" @click="showPullDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="pullImage">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showCreateDialog" title="创建容器" width="60%" @close="form = { image: '', name: '', ports: '', env: '', command: '' }">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="镜像">
          <ElInput v-model="form.image" placeholder="如: nginx:latest" />
        </ElFormItem>
        <ElFormItem label="容器名称">
          <ElInput v-model="form.name" placeholder="请输入容器名称" />
        </ElFormItem>
        <ElFormItem label="端口映射">
          <ElInput v-model="form.ports" placeholder="如: 8080:80, 3000:3000" />
        </ElFormItem>
        <ElFormItem label="环境变量">
          <ElInput v-model="form.env" placeholder="如: NODE_ENV=production" />
        </ElFormItem>
        <ElFormItem label="启动命令">
          <ElInput v-model="form.command" placeholder="可选启动命令" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button class="el-button" @click="showCreateDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createContainer">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showLogsDialog" :title="`${selectedContainer?.name} - 日志`" width="80%">
      <pre class="logs-content">{{ containerLogs }}</pre>
      <template #footer>
        <button class="el-button" @click="showLogsDialog = false">关闭</button>
        <button class="el-button el-button--primary" @click="viewLogs(selectedContainer!)" :disabled="!selectedContainer">刷新</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showDeployDialog" :title="selectedTemplate?.name ? `${selectedTemplate.name} 部署` : '编辑部署'" width="80%">
      <textarea v-model="composeContent" class="compose-textarea" placeholder="在此输入 docker-compose.yml 内容"></textarea>
      <template #footer>
        <button class="el-button" @click="showDeployDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="confirmDeploy">部署</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showFileDeployDialog" title="从文件部署" width="500px">
      <div class="file-deploy-content">
        <div class="deploy-mode-tabs">
          <button 
            :class="['mode-btn', deployMode === 'upload' ? 'active' : '']"
            @click="deployMode = 'upload'"
          >
            <i class="el-icon-upload2"></i>
            上传文件
          </button>
          <button 
            :class="['mode-btn', deployMode === 'path' ? 'active' : '']"
            @click="switchToPathMode"
          >
            <i class="el-icon-folder-opened"></i>
            选择路径
          </button>
        </div>
        
        <div v-if="deployMode === 'upload'" class="upload-section">
          <div class="upload-area" @click="fileInput?.click()">
            <input 
              ref="fileInput" 
              type="file" 
              accept=".yml,.yaml" 
              style="display: none" 
              @change="handleFileSelect"
            />
            <i class="el-icon-upload upload-icon"></i>
            <p v-if="!selectedDeployFile" class="upload-text">点击选择 docker-compose.yml 文件</p>
            <p v-else class="file-name">{{ selectedDeployFile.name }}</p>
            <p class="upload-hint">支持 .yml 和 .yaml 格式</p>
          </div>
        </div>
        
        <div v-else class="path-section">
          <div class="browser-toolbar">
            <button class="browser-tool-btn" @click="browseBack" :disabled="browserPathHistory.length === 0" title="后退">
              <i class="el-icon-back"></i>
            </button>
            <button class="browser-tool-btn" @click="browseUp" :disabled="browserCurrentPath === '/'" title="上一级">
              <i class="el-icon-top"></i>
            </button>
            <button class="browser-tool-btn" @click="browseTo('/')" title="根目录">
              <i class="el-icon-house"></i>
            </button>
            <span class="browser-current-path">{{ browserCurrentPath }}</span>
            <button class="browser-tool-btn refresh-btn" @click="browseTo(browserCurrentPath)" title="刷新">
              <i class="el-icon-refresh"></i>
            </button>
          </div>
          
          <div class="browser-container" v-loading="browserLoading">
            <div v-if="browserItems.length === 0 && !browserLoading" class="browser-empty">
              <i class="el-icon-folder-opened"></i>
              <p>该目录下没有可用的文件</p>
            </div>
            <div 
              v-for="item in browserItems" 
              :key="item.path"
              :class="['browser-item', item.type, { selected: deployFilePath === item.path }]"
              @click="selectBrowserItem(item)"
              @dblclick="item.type === 'directory' && browseTo(item.path)"
            >
              <i :class="item.type === 'directory' ? 'el-icon-folder' : 'el-icon-document'"></i>
              <span class="browser-item-name">{{ item.name }}</span>
              <i v-if="item.type === 'directory'" class="el-icon-arrow-right browser-item-arrow"></i>
            </div>
          </div>
          
          <div v-if="deployFilePath" class="selected-path">
            <i class="el-icon-document-checked"></i>
            <span>已选择: {{ deployFilePath }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="el-button" @click="showFileDeployDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="confirmFileDeploy" :disabled="deployLoading">
          <i v-if="deployLoading" class="el-icon-loading"></i>
          {{ deployLoading ? '部署中...' : '部署' }}
        </button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showComposeLogs" title="Compose 日志" width="80%">
      <pre class="logs-content">{{ composeLogs }}</pre>
      <template #footer>
        <button class="el-button" @click="showComposeLogs = false">关闭</button>
        <button class="el-button el-button--primary" @click="viewComposeLogs">刷新</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showServicesDialog" title="Compose 服务状态" width="60%">
      <div class="services-table">
        <table>
          <thead>
            <tr>
              <th>服务名称</th>
              <th>镜像</th>
              <th>状态</th>
              <th>端口</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="service in composeServices" :key="service.name">
              <td>{{ service.name }}</td>
              <td>{{ service.image }}</td>
              <td>
                <span class="status-tag" :class="service.state.toLowerCase().includes('running') ? 'success' : service.state.toLowerCase().includes('exited') ? 'error' : 'warning'">
                  {{ service.state }}
                </span>
              </td>
              <td>{{ service.ports || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="composeServices.length === 0" class="empty-state">
          <p>暂无运行中的服务</p>
        </div>
      </div>
      <template #footer>
        <button class="el-button" @click="showServicesDialog = false">关闭</button>
        <button class="el-button el-button--primary" @click="viewServices">刷新</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showDockerInstallDialog" title="Docker 未安装" width="450px">
      <div class="docker-install-tip">
        <div class="tip-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#f5a623" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p class="tip-title">Docker 未安装或未正确配置</p>
        <p class="tip-desc">容器管理功能需要 Docker 环境支持，请先在系统管理页面安装 Docker。</p>
      </div>
      <template #footer>
        <button class="el-button" @click="showDockerInstallDialog = false">关闭</button>
        <button class="el-button el-button--primary" @click="goToSystemPage">前往安装</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showCreateProjectDialog" title="创建编排项目" width="70%" @close="composeForm = { projectName: '', projectPath: '/opt', services: [{ name: '', image: '', ports: [], env: [{ key: '', value: '' }], volumes: [], restart: 'always', command: '' }] }">
      <ElForm :model="composeForm" label-width="120px">
        <ElFormItem label="项目名称">
          <ElInput v-model="composeForm.projectName" placeholder="请输入项目名称" />
        </ElFormItem>
        <ElFormItem label="项目路径">
          <ElInput v-model="composeForm.projectPath" placeholder="如: /opt/myproject" />
        </ElFormItem>
        
        <div v-for="(service, serviceIndex) in composeForm.services" :key="serviceIndex" class="service-section">
          <div class="service-header">
            <span class="service-title">服务 {{ serviceIndex + 1 }}</span>
            <button v-if="composeForm.services.length > 1" class="remove-service-btn" @click="removeService(serviceIndex)">
              <i class="el-icon-delete"></i>
            </button>
          </div>
          
          <ElFormItem label="服务名称">
            <ElInput v-model="service.name" placeholder="如: web" />
          </ElFormItem>
          
          <ElFormItem label="镜像名称">
            <ElInput v-model="service.image" placeholder="如: nginx:latest" />
          </ElFormItem>
          
          <ElFormItem label="端口映射">
            <div class="port-list">
              <div v-for="(_port, portIndex) in service.ports" :key="portIndex" class="port-item">
                <ElInput v-model="service.ports[portIndex]" placeholder="如: 80:80" />
                <button v-if="service.ports.length > 0" @click="removePort(service, portIndex)">
                  <i class="el-icon-minus"></i>
                </button>
              </div>
              <button class="add-port-btn" @click="addPort(service)">
                <i class="el-icon-plus"></i> 添加端口
              </button>
            </div>
          </ElFormItem>
          
          <ElFormItem label="环境变量">
            <div class="env-list">
              <div v-for="(env, envIndex) in service.env" :key="envIndex" class="env-item">
                <ElInput v-model="env.key" placeholder="变量名" class="env-key" />
                <span class="env-separator">=</span>
                <ElInput v-model="env.value" placeholder="变量值" class="env-value" />
                <button v-if="service.env.length > 1" @click="removeEnv(service, envIndex)">
                  <i class="el-icon-minus"></i>
                </button>
              </div>
              <button class="add-env-btn" @click="addEnv(service)">
                <i class="el-icon-plus"></i> 添加变量
              </button>
            </div>
          </ElFormItem>
          
          <ElFormItem label="数据卷挂载">
            <div class="volume-list">
              <div v-for="(_volume, volumeIndex) in service.volumes" :key="volumeIndex" class="volume-item">
                <ElInput v-model="service.volumes[volumeIndex]" placeholder="如: ./data:/var/lib/mysql" />
                <button v-if="service.volumes.length > 0" @click="removeVolume(service, volumeIndex)">
                  <i class="el-icon-minus"></i>
                </button>
              </div>
              <button class="add-volume-btn" @click="addVolume(service)">
                <i class="el-icon-plus"></i> 添加数据卷
              </button>
            </div>
          </ElFormItem>
          
          <ElFormItem label="重启策略">
            <ElSelect v-model="service.restart" placeholder="选择重启策略">
              <ElOption label="始终重启" value="always" />
              <ElOption label="不重启" value="no" />
              <ElOption label="失败时重启" value="on-failure" />
              <ElOption label="除非手动停止" value="unless-stopped" />
            </ElSelect>
          </ElFormItem>
          
          <ElFormItem label="启动命令">
            <ElInput v-model="service.command" placeholder="可选，覆盖默认命令" />
          </ElFormItem>
        </div>
        
        <button class="add-service-btn" @click="addService">
          <i class="el-icon-plus"></i> 添加服务
        </button>
      </ElForm>
      <template #footer>
        <button class="el-button" @click="showCreateProjectDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createProject">创建</button>
      </template>
    </ElDialog>

    <ElDialog v-model="showDeployLogDialog" title="部署日志" width="800px" :close-on-click-modal="false" :close-on-press-escape="!deploying" :show-close="!deploying">
      <div class="deploy-log-container">
        <div ref="deployLogContent" class="deploy-log-content">
          <pre>{{ deployLogs || '等待部署日志输出...' }}</pre>
        </div>
        <div v-if="deploying" class="deploy-status deploying">
          <span class="status-dot"></span>
          部署中，请稍候...
        </div>
        <div v-else-if="deploySuccess" class="deploy-status success">
          <span class="status-dot"></span>
          部署完成
        </div>
        <div v-else class="deploy-status failed">
          <span class="status-dot"></span>
          部署失败
        </div>
      </div>
      <template #footer>
        <button class="el-button" :disabled="deploying" @click="showDeployLogDialog = false">关闭</button>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.containers-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.tabs {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.tab-content {
  margin-top: 20px;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 20px;
}

.create-btn:hover {
  background: #66b1ff;
}

.containers-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

th {
  background: #fafafa;
  font-weight: 600;
  color: #666;
}

.status-tag {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.success {
  background: #f0f9ff;
  color: #409eff;
}

.status-tag.error {
  background: #fef0f0;
  color: #e74c3c;
}

.status-tag.warning {
  background: #fdf6ec;
  color: #e6a23c;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f5f5f5;
}

.start-btn:hover {
  background: #f0f9ff;
  color: #409eff;
  border-color: #409eff;
}

.stop-btn:hover {
  background: #fdf6ec;
  color: #e6a23c;
  border-color: #e6a23c;
}

.delete-btn:hover {
  background: #fef0f0;
  color: #e74c3c;
  border-color: #e74c3c;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-state i {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 16px;
}

.empty-state p {
  color: #999;
  margin-bottom: 16px;
}

.empty-state button {
  padding: 10px 24px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.image-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.image-info {
  flex: 1;
}

.image-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.image-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.image-card .delete-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.image-card .delete-btn:hover {
  background: #fef0f0;
}

.logs-content {
  width: 100%;
  height: 400px;
  padding: 16px;
  background: #1a1a1a;
  color: #fff;
  border-radius: 8px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
}

.compose-layout {
  display: flex;
  gap: 20px;
  height: 500px;
}

.file-browser {
  width: 300px;
  background: #fafafa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.browser-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  border-radius: 8px 8px 0 0;
}

.browser-header button {
  width: 32px;
  height: 32px;
  border: none;
  background: #f0f0f0;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.browser-header button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.browser-header span {
  flex: 1;
  font-size: 13px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browser-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.browser-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 13px;
}

.browser-item:hover {
  background: #f0f0f0;
}

.browser-item.directory {
  color: #409eff;
}

.browser-item.file {
  color: #666;
}

.compose-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  border-radius: 8px 8px 0 0;
}

.editor-header span {
  font-size: 13px;
  color: #666;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.editor-actions button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: #f0f0f0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.editor-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.editor-actions .danger-btn {
  background: #e74c3c;
  color: #fff;
}

.editor-actions .danger-btn:hover {
  background: #c0392b;
}

.compose-textarea {
  flex: 1;
  padding: 16px;
  border: none;
  resize: none;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #fff;
  border-radius: 0 0 8px 8px;
}

.compose-textarea:focus {
  outline: none;
}

.services-table {
  overflow-x: auto;
}

.services-table table {
  width: 100%;
  border-collapse: collapse;
}

.services-table th, .services-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.services-table th {
  background: #fafafa;
  font-weight: 600;
  color: #666;
}

.docker-install-tip {
  text-align: center;
  padding: 20px 0;
}

.tip-icon {
  margin-bottom: 16px;
}

.tip-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.tip-desc {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.compose-header {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.quick-templates {
  margin-bottom: 30px;
}

.template-title,
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.template-card {
  background: #fafafa;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #f0f0f0;
}

.template-card:hover {
  background: #f0f9ff;
  border-color: #409eff;
}

.template-icon {
  font-size: 40px;
  color: #409eff;
  margin-bottom: 12px;
}

.template-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.template-desc {
  font-size: 13px;
  color: #999;
  margin-bottom: 12px;
}

.deploy-btn {
  padding: 6px 16px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.deploy-btn:hover {
  background: #66b1ff;
}

.projects-section {
  margin-top: 20px;
}

.projects-table {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.projects-table table {
  width: 100%;
  border-collapse: collapse;
}

.projects-table th,
.projects-table td {
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.projects-table th {
  background: #fafafa;
  font-weight: 600;
  color: #666;
}

.project-name {
  font-weight: 500;
  color: #333;
}

.project-path {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.services-count {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

.project-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.project-actions .action-btn {
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.project-actions .action-btn:hover {
  background: #f5f5f5;
}

.project-actions .delete-btn:hover {
  background: #fef0f0;
  color: #e74c3c;
  border-color: #e74c3c;
}

.service-section {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e0e0e0;
}

.service-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.remove-service-btn {
  color: #e74c3c;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
}

.port-list,
.env-list,
.volume-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.port-item,
.env-item,
.volume-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.env-item {
  gap: 4px;
}

.env-key,
.env-value {
  flex: 1;
}

.env-separator {
  color: #999;
}

.add-port-btn,
.add-env-btn,
.add-volume-btn,
.add-service-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px dashed #409eff;
  background: #f0f9ff;
  color: #409eff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  margin-top: 8px;
  transition: all 0.2s;
}

.add-port-btn:hover,
.add-env-btn:hover,
.add-volume-btn:hover,
.add-service-btn:hover {
  background: #e6f7ff;
  border-style: solid;
}

.add-service-btn {
  width: 100%;
  justify-content: center;
  margin-top: 16px;
  padding: 10px;
}

.file-deploy-content {
  padding: 10px 0;
}

.deploy-mode-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  transition: all 0.25s ease;
  font-weight: 500;
}

.mode-btn:hover {
  border-color: #91d5ff;
  color: #1890ff;
  background: #f0f9ff;
}

.mode-btn.active {
  background: linear-gradient(135deg, #1890ff 0%, #40a9ff 100%);
  border-color: #1890ff;
  color: #fff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
}

.mode-btn i {
  font-size: 16px;
}

.upload-section {
  display: flex;
  justify-content: center;
}

.upload-area {
  width: 100%;
  padding: 50px 20px;
  border: 2px dashed #d9d9d9;
  border-radius: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%);
}

.upload-area:hover {
  border-color: #1890ff;
  background: linear-gradient(180deg, #f0f9ff 0%, #e6f7ff 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.1);
}

.upload-icon {
  font-size: 56px !important;
  color: #bfbfbf;
  margin-bottom: 16px;
  display: block;
  transition: all 0.3s ease;
}

.upload-area:hover .upload-icon {
  color: #1890ff;
  transform: scale(1.1);
}

.upload-text {
  font-size: 15px;
  color: #606266;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.file-name {
  font-size: 15px;
  color: #1890ff;
  margin: 0 0 8px 0;
  font-weight: 600;
  word-break: break-all;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
  margin: 0;
}

.path-section {
  width: 100%;
}

.browser-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  background: linear-gradient(180deg, #fafbfc 0%, #f5f7fa 100%);
  border: 1px solid #e4e7ed;
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid #ebeef5;
}

.browser-tool-btn {
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606266;
  font-size: 14px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.browser-tool-btn:hover:not(:disabled) {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: #409eff;
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.15);
}

.browser-tool-btn:active:not(:disabled) {
  background: #d9ecff;
  transform: scale(0.96);
}

.browser-tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: #f5f7fa;
}

.browser-current-path {
  flex: 1;
  margin: 0 8px;
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.refresh-btn {
  margin-left: auto;
}

.browser-container {
  height: 340px;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid #e4e7ed;
  border-top: none;
  border-radius: 0 0 8px 8px;
  background: #fff;
  padding: 8px;
}

.browser-container::-webkit-scrollbar {
  width: 6px;
}

.browser-container::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}

.browser-container::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

.browser-container::-webkit-scrollbar-thumb:hover {
  background: #909399;
}

.browser-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  gap: 12px;
}

.browser-empty i {
  font-size: 48px;
  opacity: 0.6;
}

.browser-empty p {
  font-size: 13px;
  margin: 0;
  color: #909399;
}

.browser-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;
  color: #303133;
  margin-bottom: 2px;
  border: 1px solid transparent;
  border-bottom: 1px dashed #b3d8ff;
}

.browser-item:last-child {
  margin-bottom: 0;
  border-bottom: 1px solid transparent;
}

.browser-item:hover {
  background: #f5f7fa;
  border-color: #ebeef5;
}

.browser-item:active {
  background: #ebeef5;
}

.browser-item.selected {
  background: linear-gradient(90deg, #ecf5ff 0%, #d9ecff 100%);
  border-color: #b3d8ff;
  color: #409eff;
  box-shadow: 0 1px 4px rgba(64, 158, 255, 0.1);
}

.browser-item.directory {
  color: #409eff;
}

.browser-item.directory:hover {
  background: #ecf5ff;
  border-color: #d9ecff;
}

.browser-item.selected.directory {
  color: #409eff;
  font-weight: 500;
}

.browser-item i:first-child {
  font-size: 18px;
  flex-shrink: 0;
}

.browser-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
}

.browser-item-arrow {
  color: #dcdfe6;
  font-size: 12px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.browser-item:hover .browser-item-arrow,
.browser-item.selected .browser-item-arrow {
  opacity: 1;
}

.selected-path {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 14px;
  background: linear-gradient(90deg, #f0f9ff 0%, #e6f7ff 100%);
  border: 1px solid #b3e5fc;
  border-radius: 8px;
  font-size: 13px;
  color: #0288d1;
  box-shadow: 0 1px 4px rgba(2, 136, 209, 0.08);
}

.selected-path i {
  font-size: 18px;
  flex-shrink: 0;
}

.selected-path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.form-item {
  margin-bottom: 10px;
}

.form-label {
  display: block;
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
  font-weight: 500;
}

.path-hint {
  font-size: 12px;
  color: #909399;
  margin: 8px 0 0 0;
}

.deploy-log-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deploy-log-content {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #333;
}

.deploy-log-content pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-all;
}

.deploy-log-content::-webkit-scrollbar {
  width: 8px;
}

.deploy-log-content::-webkit-scrollbar-track {
  background: #2d2d2d;
  border-radius: 4px;
}

.deploy-log-content::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.deploy-log-content::-webkit-scrollbar-thumb:hover {
  background: #777;
}

.deploy-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.deploy-status .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.deploy-status.deploying {
  background: #ecf5ff;
  color: #409eff;
}

.deploy-status.deploying .status-dot {
  background: #409eff;
  animation: pulse 1.2s infinite;
}

.deploy-status.success {
  background: #f0f9eb;
  color: #67c23a;
}

.deploy-status.success .status-dot {
  background: #67c23a;
}

.deploy-status.failed {
  background: #fef0f0;
  color: #f56c6c;
}

.deploy-status.failed .status-dot {
  background: #f56c6c;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>