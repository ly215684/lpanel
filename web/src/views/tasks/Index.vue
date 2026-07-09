<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTasksApi, createTaskApi, updateTaskApi, deleteTaskApi, runTaskApi, getTaskExecutionsApi, listFilesApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElSwitch } from 'element-plus'

interface Task {
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

interface TaskExecution {
  id: string
  status: string
  output?: string
  error?: string
  started_at: string
  finished_at?: string
}

interface BrowserItem {
  name: string
  path: string
  type: 'file' | 'directory'
}

const tasks = ref<Task[]>([])
const executions = ref<TaskExecution[]>([])
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showExecutionsDialog = ref(false)
const selectedTask = ref<Task | null>(null)
const form = ref({
  name: '',
  type: 'backup',
  cron_expression: '',
  command: ''
})

const showFileBrowser = ref(false)
const browserCurrentPath = ref('/')
const browserItems = ref<BrowserItem[]>([])
const browserPathHistory = ref<string[]>([])
const browserLoading = ref(false)

function formatCron(cron: string): string {
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}`
}

async function browseTo(path: string) {
  browserLoading.value = true
  try {
    const items = await listFilesApi(path)
    const dirs = items.filter(item => item.type === 'directory').map(item => ({ name: item.name, path: item.path, type: item.type }))
    const files = items.filter(item => item.type === 'file').map(item => ({ name: item.name, path: item.path, type: item.type }))
    browserItems.value = [...dirs, ...files]
    if (browserCurrentPath.value !== path) {
      browserPathHistory.value.push(browserCurrentPath.value)
    }
    browserCurrentPath.value = path
  } catch {
    ElMessage.error('读取目录失败')
  } finally {
    browserLoading.value = false
  }
}

function browseBack() {
  if (browserPathHistory.value.length > 0) {
    const prevPath = browserPathHistory.value.pop()!
    browseTo(prevPath)
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

function selectBrowserItem(item: BrowserItem) {
  if (item.type === 'directory') {
    browseTo(item.path)
  } else {
    form.value.command = item.path
    showFileBrowser.value = false
  }
}

function openFileBrowser() {
  browserCurrentPath.value = '/'
  browserItems.value = []
  browserPathHistory.value = []
  showFileBrowser.value = true
  browseTo('/')
}

async function loadTasks() {
  try {
    tasks.value = await getTasksApi()
  } catch {
    ElMessage.error('加载任务列表失败')
  }
}

async function createTask() {
  if (!form.value.name || !form.value.cron_expression) {
    ElMessage.warning('请填写完整信息')
    return
  }
  const data = {
    name: form.value.name,
    type: form.value.type,
    cron_expression: form.value.cron_expression,
    command: form.value.command || undefined
  }
  try {
    await createTaskApi(data)
    ElMessage.success('任务创建成功')
    showCreateDialog.value = false
    form.value = { name: '', type: 'backup', cron_expression: '', command: '' }
    loadTasks()
  } catch {
    ElMessage.error('任务创建失败')
  }
}

async function openEdit(task: Task) {
  selectedTask.value = task
  form.value = {
    name: task.name,
    type: task.type,
    cron_expression: task.cron_expression,
    command: task.command || ''
  }
  showEditDialog.value = true
}

async function saveEdit() {
  if (!selectedTask.value) return
  if (!form.value.name || !form.value.cron_expression) {
    ElMessage.warning('请填写完整信息')
    return
  }
  const data = {
    name: form.value.name,
    type: form.value.type,
    cron_expression: form.value.cron_expression,
    command: form.value.command || undefined,
    status: selectedTask.value.status
  }
  try {
    await updateTaskApi(selectedTask.value.id, data)
    ElMessage.success('任务更新成功')
    showEditDialog.value = false
    loadTasks()
  } catch {
    ElMessage.error('任务更新失败')
  }
}

async function toggleTask(task: Task) {
  const newStatus = task.status === 'enabled' ? 'disabled' : 'enabled'
  try {
    await updateTaskApi(task.id, { status: newStatus })
    ElMessage.success(newStatus === 'enabled' ? '任务已启用' : '任务已禁用')
    loadTasks()
  } catch {
    ElMessage.error('操作失败')
  }
}

async function deleteTask(id: string) {
  try {
    await deleteTaskApi(id)
    ElMessage.success('删除成功')
    loadTasks()
  } catch {
    ElMessage.error('删除失败')
  }
}

async function run(id: string) {
  try {
    await runTaskApi(id)
    ElMessage.success('任务执行成功')
    loadTasks()
  } catch {
    ElMessage.error('任务执行失败')
  }
}

async function openExecutions(task: Task) {
  selectedTask.value = task
  try {
    executions.value = await getTaskExecutionsApi(task.id)
  } catch {
    executions.value = []
  }
  showExecutionsDialog.value = true
}

onMounted(() => {
  loadTasks()
})
</script>

<template>
  <div class="tasks-page">
    <div class="page-header">
      <h2>任务计划</h2>
      <button class="create-btn" @click="showCreateDialog = true">
        <i class="el-icon-plus"></i>
        创建任务
      </button>
    </div>
    
    <div class="tasks-table">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>定时表达式</th>
            <th>状态</th>
            <th>上次执行</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.id">
            <td>{{ task.name }}</td>
            <td>
              <span class="type-tag">{{ task.type === 'backup' ? '备份' : task.type === 'command' ? '命令' : task.type === 'script' ? '脚本' : task.type }}</span>
            </td>
            <td>{{ formatCron(task.cron_expression) }}</td>
            <td>
              <ElSwitch 
                :model-value="task.status === 'enabled'" 
                @change="toggleTask(task)"
                :active-color="'#409eff'"
                :inactive-color="'#ccc'"
              />
              <span class="status-text">{{ task.status === 'enabled' ? '启用' : '禁用' }}</span>
            </td>
            <td>{{ task.last_run_at ? new Date(task.last_run_at).toLocaleString() : '-' }}</td>
            <td>{{ new Date(task.created_at).toLocaleString() }}</td>
            <td>
              <div class="actions">
                <button class="action-btn" @click="openExecutions(task)">
                  <i class="el-icon-view"></i>
                  日志
                </button>
                <button class="action-btn" @click="openEdit(task)">
                  <i class="el-icon-edit"></i>
                  编辑
                </button>
                <button class="action-btn run-btn" @click="run(task.id)">
                  <i class="el-icon-play"></i>
                  执行
                </button>
                <button class="action-btn delete-btn" @click="deleteTask(task.id)">
                  <i class="el-icon-delete"></i>
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="tasks.length === 0" class="empty-state">
        <i class="el-icon-clock"></i>
        <p>暂无任务</p>
        <button @click="showCreateDialog = true">创建第一个任务</button>
      </div>
    </div>
    
    <ElDialog v-model="showCreateDialog" title="创建任务" @close="form = { name: '', type: 'backup', cron_expression: '', command: '' }">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="任务名称">
          <ElInput v-model="form.name" placeholder="请输入任务名称" />
        </ElFormItem>
        <ElFormItem label="任务类型">
          <ElSelect v-model="form.type" placeholder="请选择任务类型">
            <ElOption label="备份任务" value="backup" />
            <ElOption label="命令执行" value="command" />
            <ElOption label="脚本任务" value="script" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Cron表达式">
          <ElInput v-model="form.cron_expression" placeholder="如: 0 0 * * *" />
          <div class="cron-hint">格式: 分 时 日 月 周</div>
        </ElFormItem>
        <ElFormItem :label="form.type === 'script' ? '脚本路径' : '执行命令'">
          <div v-if="form.type === 'script'" class="script-input-group">
            <ElInput 
              v-model="form.command" 
              placeholder="如: /opt/scripts/backup.sh" 
            />
            <button class="browse-btn" @click="openFileBrowser">
              <i class="el-icon-folder-opened"></i>
              浏览
            </button>
          </div>
          <ElInput 
            v-else
            v-model="form.command" 
            placeholder="任务类型为命令执行时必填" 
          />
          <div v-if="form.type === 'script'" class="cron-hint">点击浏览选择服务器上的 .sh 脚本文件，执行前会自动添加执行权限</div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button class="el-button" @click="showCreateDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createTask">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showEditDialog" title="编辑任务" @close="selectedTask = null">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="任务名称">
          <ElInput v-model="form.name" placeholder="请输入任务名称" />
        </ElFormItem>
        <ElFormItem label="任务类型">
          <ElSelect v-model="form.type" placeholder="请选择任务类型">
            <ElOption label="备份任务" value="backup" />
            <ElOption label="命令执行" value="command" />
            <ElOption label="脚本任务" value="script" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Cron表达式">
          <ElInput v-model="form.cron_expression" placeholder="如: 0 0 * * *" />
        </ElFormItem>
        <ElFormItem :label="form.type === 'script' ? '脚本路径' : '执行命令'">
          <div v-if="form.type === 'script'" class="script-input-group">
            <ElInput 
              v-model="form.command" 
              placeholder="如: /opt/scripts/backup.sh" 
            />
            <button class="browse-btn" @click="openFileBrowser">
              <i class="el-icon-folder-opened"></i>
              浏览
            </button>
          </div>
          <ElInput 
            v-else
            v-model="form.command" 
            placeholder="任务类型为命令执行时必填" 
          />
          <div v-if="form.type === 'script'" class="cron-hint">点击浏览选择服务器上的 .sh 脚本文件，执行前会自动添加执行权限</div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button class="el-button" @click="showEditDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="saveEdit">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showFileBrowser" title="选择脚本文件" width="550px">
      <div class="file-browser-content">
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
            <p>该目录下没有文件</p>
          </div>
          <div 
            v-for="item in browserItems" 
            :key="item.path"
            :class="['browser-item', item.type, { selected: form.command === item.path }]"
            @click="selectBrowserItem(item)"
            @dblclick="item.type === 'directory' && browseTo(item.path)"
          >
            <i :class="item.type === 'directory' ? 'el-icon-folder' : 'el-icon-document'"></i>
            <span class="browser-item-name">{{ item.name }}</span>
            <i v-if="item.type === 'directory'" class="el-icon-arrow-right browser-item-arrow"></i>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="el-button" @click="showFileBrowser = false">取消</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showExecutionsDialog" :title="`${selectedTask?.name} - 执行日志`" width="80%">
      <div class="executions-list">
        <div v-for="exec in executions" :key="exec.id" class="execution-item">
          <div class="execution-header">
            <span class="execution-time">{{ new Date(exec.started_at).toLocaleString() }}</span>
            <span class="status-tag" :class="exec.status === 'success' ? 'success' : exec.status === 'running' ? 'warning' : 'error'">
              {{ exec.status === 'success' ? '成功' : exec.status === 'running' ? '执行中' : '失败' }}
            </span>
          </div>
          <div v-if="exec.output" class="execution-output">
            <div class="output-label">输出:</div>
            <pre>{{ exec.output }}</pre>
          </div>
          <div v-if="exec.error" class="execution-error">
            <div class="error-label">错误:</div>
            <pre>{{ exec.error }}</pre>
          </div>
        </div>
        <div v-if="executions.length === 0" class="empty-executions">
          <p>暂无执行记录</p>
        </div>
      </div>
      <template #footer>
        <button @click="showExecutionsDialog = false">关闭</button>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.tasks-page {
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
}

.create-btn:hover {
  background: #66b1ff;
}

.tasks-table {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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

.type-tag {
  padding: 4px 12px;
  background: #f0f9ff;
  color: #409eff;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-text {
  margin-left: 8px;
  font-size: 13px;
  color: #666;
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

.run-btn:hover {
  background: #f0f9ff;
  color: #409eff;
  border-color: #409eff;
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

.cron-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.executions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.execution-item {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.execution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.execution-time {
  font-weight: 500;
  color: #333;
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

.execution-output,
.execution-error {
  margin-top: 8px;
}

.output-label,
.error-label {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}

.output-label {
  color: #67c23a;
}

.error-label {
  color: #e74c3c;
}

.execution-output pre,
.execution-error pre {
  padding: 12px;
  background: #1a1a1a;
  color: #fff;
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.empty-executions {
  text-align: center;
  padding: 30px;
  color: #999;
}

.script-input-group {
  display: flex;
  gap: 8px;
  width: 100%;
}

.script-input-group :deep(.el-input) {
  flex: 1;
}

.browse-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  transition: all 0.2s;
}

.browse-btn:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}

.file-browser-content {
  padding: 0;
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
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
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

.browser-item i:first-child {
  font-size: 18px;
  flex-shrink: 0;
}

.browser-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>