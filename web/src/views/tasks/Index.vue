<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTasksApi, createTaskApi, updateTaskApi, deleteTaskApi, runTaskApi, getTaskExecutionsApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElSwitch } from 'element-plus'

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

function formatCron(cron: string): string {
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}`
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
              <span class="type-tag">{{ task.type === 'backup' ? '备份' : task.type === 'command' ? '命令' : task.type }}</span>
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
          <ElSelect v-model="form.type">
            <option value="backup">备份任务</option>
            <option value="command">命令执行</option>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Cron表达式">
          <ElInput v-model="form.cron_expression" placeholder="如: 0 0 * * *" />
          <div class="cron-hint">格式: 分 时 日 月 周</div>
        </ElFormItem>
        <ElFormItem label="执行命令">
          <ElInput v-model="form.command" placeholder="任务类型为命令执行时必填" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button @click="showCreateDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createTask">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showEditDialog" title="编辑任务" @close="selectedTask = null">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="任务名称">
          <ElInput v-model="form.name" placeholder="请输入任务名称" />
        </ElFormItem>
        <ElFormItem label="任务类型">
          <ElSelect v-model="form.type">
            <option value="backup">备份任务</option>
            <option value="command">命令执行</option>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Cron表达式">
          <ElInput v-model="form.cron_expression" placeholder="如: 0 0 * * *" />
        </ElFormItem>
        <ElFormItem label="执行命令">
          <ElInput v-model="form.command" placeholder="任务类型为命令执行时必填" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button @click="showEditDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="saveEdit">确定</button>
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
</style>