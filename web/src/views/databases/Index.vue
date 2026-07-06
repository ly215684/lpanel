<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getDatabasesApi, createDatabaseApi, deleteDatabaseApi, backupDatabaseApi, getBackupsApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElSelect } from 'element-plus'

interface Database {
  id: string
  name: string
  type: string
  host: string
  port: number
  username: string
  status: string
  created_at: string
}

interface Backup {
  id: string
  type: string
  path: string
  size: number
  status: string
  created_at: string
}

const databases = ref<Database[]>([])
const backups = ref<Backup[]>([])
const showCreateDialog = ref(false)
const showBackupDialog = ref(false)
const selectedDatabase = ref<Database | null>(null)
const form = ref({
  name: '',
  type: 'mysql',
  username: '',
  password: ''
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function loadDatabases() {
  try {
    databases.value = await getDatabasesApi()
  } catch {
    ElMessage.error('加载数据库列表失败')
  }
}

async function createDatabase() {
  if (!form.value.name || !form.value.username || !form.value.password) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await createDatabaseApi(form.value)
    ElMessage.success('数据库创建成功')
    showCreateDialog.value = false
    form.value = { name: '', type: 'mysql', username: '', password: '' }
    loadDatabases()
  } catch {
    ElMessage.error('创建数据库失败')
  }
}

async function deleteDatabase(id: string) {
  try {
    await deleteDatabaseApi(id)
    ElMessage.success('删除成功')
    loadDatabases()
  } catch {
    ElMessage.error('删除失败')
  }
}

async function openBackup(database: Database) {
  selectedDatabase.value = database
  try {
    backups.value = await getBackupsApi(database.id)
  } catch {
    backups.value = []
  }
  showBackupDialog.value = true
}

async function backup(database: Database) {
  try {
    await backupDatabaseApi(database.id)
    ElMessage.success('备份成功')
    backups.value = await getBackupsApi(database.id)
  } catch {
    ElMessage.error('备份失败')
  }
}

onMounted(() => {
  loadDatabases()
})
</script>

<template>
  <div class="databases-page">
    <div class="page-header">
      <h2>数据库管理</h2>
      <button class="create-btn" @click="showCreateDialog = true">
        <i class="el-icon-plus"></i>
        创建数据库
      </button>
    </div>
    
    <div class="databases-table">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>主机</th>
            <th>端口</th>
            <th>用户名</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="db in databases" :key="db.id">
            <td>{{ db.name }}</td>
            <td>{{ db.type.toUpperCase() }}</td>
            <td>{{ db.host }}</td>
            <td>{{ db.port }}</td>
            <td>{{ db.username }}</td>
            <td>
              <span class="status-tag" :class="db.status === 'running' ? 'success' : 'error'">
                {{ db.status === 'running' ? '运行中' : '已停止' }}
              </span>
            </td>
            <td>{{ new Date(db.created_at).toLocaleString() }}</td>
            <td>
              <div class="actions">
                <button class="action-btn" @click="openBackup(db)">
                  <i class="el-icon-download"></i>
                  备份
                </button>
                <button class="action-btn delete-btn" @click="deleteDatabase(db.id)">
                  <i class="el-icon-delete"></i>
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="databases.length === 0" class="empty-state">
        <i class="el-icon-s-data"></i>
        <p>暂无数据库</p>
        <button @click="showCreateDialog = true">创建第一个数据库</button>
      </div>
    </div>
    
    <ElDialog v-model="showCreateDialog" title="创建数据库" @close="form = { name: '', type: 'mysql', username: '', password: '' }">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="数据库名称">
          <ElInput v-model="form.name" placeholder="请输入数据库名称" />
        </ElFormItem>
        <ElFormItem label="数据库类型">
          <ElSelect v-model="form.type">
            <option value="mysql">MySQL</option>
            <option value="postgresql">PostgreSQL</option>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="用户名">
          <ElInput v-model="form.username" placeholder="请输入用户名" />
        </ElFormItem>
        <ElFormItem label="密码">
          <ElInput v-model="form.password" type="password" placeholder="请输入密码" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button @click="showCreateDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createDatabase">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showBackupDialog" :title="`${selectedDatabase?.name} - 备份管理`" width="60%">
      <div class="backup-section">
        <button class="backup-btn" @click="backup(selectedDatabase!)" :disabled="!selectedDatabase">
          <i class="el-icon-download"></i>
          创建备份
        </button>
      </div>
      <div class="backups-list">
        <div v-for="backup in backups" :key="backup.id" class="backup-item">
          <div class="backup-info">
            <div class="backup-name">{{ backup.path.split('/').pop() }}</div>
            <div class="backup-meta">
              <span>{{ backup.type }}</span>
              <span>{{ formatBytes(Number(backup.size)) }}</span>
            </div>
          </div>
          <div class="backup-status">
            <span class="status-tag" :class="backup.status === 'completed' ? 'success' : 'warning'">
              {{ backup.status === 'completed' ? '已完成' : '备份中' }}
            </span>
          </div>
          <div class="backup-time">{{ new Date(backup.created_at).toLocaleString() }}</div>
        </div>
        <div v-if="backups.length === 0" class="empty-backups">
          <p>暂无备份</p>
        </div>
      </div>
      <template #footer>
        <button @click="showBackupDialog = false">关闭</button>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.databases-page {
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

.databases-table {
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

.backup-section {
  margin-bottom: 20px;
}

.backup-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #67c23a;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.backup-btn:hover {
  background: #85ce61;
}

.backup-btn[disabled] {
  background: #ccc;
  cursor: not-allowed;
}

.backups-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.backup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
}

.backup-info {
  flex: 1;
}

.backup-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.backup-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.backup-status {
  margin: 0 16px;
}

.backup-time {
  font-size: 12px;
  color: #999;
}

.empty-backups {
  text-align: center;
  padding: 30px;
  color: #999;
}
</style>