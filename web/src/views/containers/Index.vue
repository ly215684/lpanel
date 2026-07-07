<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getImagesApi, pullImageApi, removeImageApi, getContainersApi, createContainerApi, startContainerApi, stopContainerApi, removeContainerApi, getContainerLogsApi, composeUpApi, composeDownApi, composeLogsApi, listDirectoryApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElTabs, ElTabPane } from 'element-plus'

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

const currentPath = ref('/')
const directoryItems = ref<Array<{ name: string; type: 'file' | 'directory'; path: string }>>([])
const selectedComposePath = ref('')

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

async function loadDirectory(path: string) {
  try {
    directoryItems.value = await listDirectoryApi(path)
    currentPath.value = path
  } catch {
    ElMessage.error('加载目录失败')
  }
}

function goBack() {
  if (currentPath.value !== '/') {
    const parent = currentPath.value.substring(0, currentPath.value.lastIndexOf('/')) || '/'
    loadDirectory(parent)
  }
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

async function selectComposeFile(item: { name: string; type: 'file' | 'directory'; path: string }) {
  try {
    selectedComposePath.value = item.path
    await composeUpApi({ path: item.path })
    ElMessage.success(`Compose 服务启动成功: ${item.name}`)
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

async function runCompose() {
  if (selectedComposePath.value) {
    try {
      await composeUpApi({ path: selectedComposePath.value })
      ElMessage.success('Compose 服务启动成功')
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
  } else if (composeContent.value.trim()) {
    try {
      await composeUpApi({ content: composeContent.value })
      ElMessage.success('Compose 服务启动成功')
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
  } else {
    ElMessage.warning('请选择文件或输入内容')
  }
}

async function stopCompose() {
  if (selectedComposePath.value) {
    try {
      await composeDownApi(selectedComposePath.value)
      ElMessage.success('Compose 服务已停止')
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
  } else {
    ElMessage.warning('请选择文件')
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

onMounted(() => {
  loadImages()
  loadContainers()
})

watch(activeTab, (newVal) => {
  if (newVal === 'compose') {
    loadDirectory('/')
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
      
      <ElTabPane label="Compose" name="compose">
        <div class="tab-content">
          <div class="compose-layout">
            <div class="file-browser">
              <div class="browser-header">
                <button @click="goBack" :disabled="currentPath === '/'">
                  <i class="el-icon-back"></i>
                </button>
                <span>{{ currentPath }}</span>
                <button @click="loadDirectory('/')">
                  <i class="el-icon-home"></i>
                </button>
              </div>
              <div class="browser-list">
                <div 
                  v-for="item in directoryItems" 
                  :key="item.path"
                  class="browser-item"
                  :class="item.type"
                  @click="item.type === 'directory' ? loadDirectory(item.path) : item.name.endsWith('.yml') || item.name.endsWith('.yaml') ? selectComposeFile(item) : null"
                >
                  <i :class="item.type === 'directory' ? 'el-icon-folder-opened' : 'el-icon-document'"></i>
                  <span>{{ item.name }}</span>
                </div>
              </div>
            </div>
            
            <div class="compose-editor">
              <div class="editor-header">
                <span>手动输入配置</span>
                <div class="editor-actions">
                  <button @click="viewComposeLogs" :disabled="!selectedComposePath">
                    <i class="el-icon-view"></i>
                    日志
                  </button>
                  <button @click="stopCompose" :disabled="!selectedComposePath">
                    <i class="el-icon-pause"></i>
                    停止
                  </button>
                  <button class="el-button el-button--primary" @click="runCompose">
                    <i class="el-icon-play"></i>
                    启动
                  </button>
                </div>
              </div>
              <textarea v-model="composeContent" class="compose-textarea" placeholder="在此输入 docker-compose.yml 内容，或从左侧直接点击 .yml 文件运行"></textarea>
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
        <button @click="showPullDialog = false">取消</button>
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
        <button @click="showCreateDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createContainer">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showLogsDialog" :title="`${selectedContainer?.name} - 日志`" width="80%">
      <pre class="logs-content">{{ containerLogs }}</pre>
      <template #footer>
        <button @click="showLogsDialog = false">关闭</button>
        <button class="el-button el-button--primary" @click="viewLogs(selectedContainer!)" :disabled="!selectedContainer">刷新</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showComposeLogs" title="Compose 日志" width="80%">
      <pre class="logs-content">{{ composeLogs }}</pre>
      <template #footer>
        <button @click="showComposeLogs = false">关闭</button>
        <button class="el-button el-button--primary" @click="viewComposeLogs">刷新</button>
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
</style>