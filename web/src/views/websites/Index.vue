<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getWebsitesApi, createWebsiteApi, deleteWebsiteApi, enableSSLApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElSelect } from 'element-plus'

interface Website {
  id: string
  name: string
  domain: string
  web_server: string
  config_path: string
  ssl_enabled: boolean
  status: string
  created_at: string
}

const websites = ref<Website[]>([])
const showCreateDialog = ref(false)
const form = ref({
  name: '',
  domain: '',
  web_server: 'nginx',
  root_path: '/var/www/html'
})

async function loadWebsites() {
  try {
    websites.value = await getWebsitesApi()
  } catch {
    ElMessage.error('加载网站列表失败')
  }
}

async function createWebsite() {
  if (!form.value.name || !form.value.domain) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await createWebsiteApi(form.value)
    ElMessage.success('网站创建成功')
    showCreateDialog.value = false
    form.value = { name: '', domain: '', web_server: 'nginx', root_path: '/var/www/html' }
    loadWebsites()
  } catch {
    ElMessage.error('创建网站失败')
  }
}

async function deleteWebsite(id: string) {
  try {
    await deleteWebsiteApi(id)
    ElMessage.success('删除成功')
    loadWebsites()
  } catch {
    ElMessage.error('删除失败')
  }
}

async function enableSSL(id: string) {
  try {
    await enableSSLApi(id)
    ElMessage.success('SSL 启用成功')
    loadWebsites()
  } catch {
    ElMessage.error('SSL 启用失败')
  }
}

onMounted(() => {
  loadWebsites()
})
</script>

<template>
  <div class="websites-page">
    <div class="page-header">
      <h2>网站管理</h2>
      <button class="create-btn" @click="showCreateDialog = true">
        <i class="el-icon-plus"></i>
        创建网站
      </button>
    </div>
    
    <div class="websites-table">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>域名</th>
            <th>Web服务器</th>
            <th>SSL</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="website in websites" :key="website.id">
            <td>{{ website.name }}</td>
            <td>{{ website.domain }}</td>
            <td>{{ website.web_server }}</td>
            <td>
              <span class="status-tag" :class="website.ssl_enabled ? 'success' : 'warning'">
                {{ website.ssl_enabled ? '已启用' : '未启用' }}
              </span>
            </td>
            <td>
              <span class="status-tag" :class="website.status === 'running' ? 'success' : 'error'">
                {{ website.status === 'running' ? '运行中' : '已停止' }}
              </span>
            </td>
            <td>{{ new Date(website.created_at).toLocaleString() }}</td>
            <td>
              <div class="actions">
                <button v-if="!website.ssl_enabled" class="action-btn" @click="enableSSL(website.id)">
                  <i class="el-icon-lock"></i>
                  SSL
                </button>
                <button class="action-btn delete-btn" @click="deleteWebsite(website.id)">
                  <i class="el-icon-delete"></i>
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="websites.length === 0" class="empty-state">
        <i class="el-icon-s-web"></i>
        <p>暂无网站</p>
        <button @click="showCreateDialog = true">创建第一个网站</button>
      </div>
    </div>
    
    <ElDialog v-model="showCreateDialog" title="创建网站" @close="form = { name: '', domain: '', web_server: 'nginx', root_path: '/var/www/html' }">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="网站名称">
          <ElInput v-model="form.name" placeholder="请输入网站名称" />
        </ElFormItem>
        <ElFormItem label="域名">
          <ElInput v-model="form.domain" placeholder="请输入域名" />
        </ElFormItem>
        <ElFormItem label="Web服务器">
          <ElSelect v-model="form.web_server">
            <option value="nginx">Nginx</option>
            <option value="apache">Apache</option>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="根目录">
          <ElInput v-model="form.root_path" placeholder="网站根目录" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button @click="showCreateDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createWebsite">确定</button>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.websites-page {
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

.websites-table {
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

.status-tag.warning {
  background: #fdf6ec;
  color: #e6a23c;
}

.status-tag.error {
  background: #fef0f0;
  color: #e74c3c;
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
</style>
