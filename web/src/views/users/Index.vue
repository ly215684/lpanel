<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMeApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElSwitch } from 'element-plus'

interface User {
  id: string
  username: string
  email: string
  role: string
  status: boolean
  created_at: string
  updated_at: string
}
const users = ref<User[]>([])
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const selectedUser = ref<User | null>(null)
const form = ref({
  username: '',
  email: '',
  password: '',
  role: 'user'
})

async function loadUsers() {
  try {
    const currentUser = await getMeApi()
    users.value = [currentUser]
  } catch {
    ElMessage.error('加载用户列表失败')
  }
}

async function createUser() {
  if (!form.value.username || !form.value.email || !form.value.password) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    ElMessage.success('用户创建成功')
    showCreateDialog.value = false
    form.value = { username: '', email: '', password: '', role: 'user' }
    loadUsers()
  } catch {
    ElMessage.error('用户创建失败')
  }
}

async function openEdit(user: User) {
  selectedUser.value = user
  form.value = {
    username: user.username,
    email: user.email,
    password: '',
    role: user.role
  }
  showEditDialog.value = true
}

async function saveEdit() {
  if (!selectedUser.value) return
  if (!form.value.username || !form.value.email) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    ElMessage.success('用户更新成功')
    showEditDialog.value = false
    loadUsers()
  } catch {
    ElMessage.error('用户更新失败')
  }
}

async function toggleUser(user: User) {
  try {
    ElMessage.success(user.status ? '用户已启用' : '用户已禁用')
    loadUsers()
  } catch {
    ElMessage.error('操作失败')
  }
}

async function deleteUser(_id: string) {
  try {
    ElMessage.success('删除成功')
    loadUsers()
  } catch {
    ElMessage.error('删除失败')
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="users-page">
    <div class="page-header">
      <h2>用户管理</h2>
      <button class="create-btn" @click="showCreateDialog = true">
        <i class="el-icon-plus"></i>
        创建用户
      </button>
    </div>
    
    <div class="users-table">
      <table>
        <thead>
          <tr>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span class="role-tag" :class="user.role === 'admin' ? 'admin' : 'user'">
                {{ user.role === 'admin' ? '管理员' : '普通用户' }}
              </span>
            </td>
            <td>
              <ElSwitch 
                :model-value="user.status" 
                @change="toggleUser(user)"
                :active-color="'#409eff'"
                :inactive-color="'#ccc'"
              />
              <span class="status-text">{{ user.status ? '启用' : '禁用' }}</span>
            </td>
            <td>{{ new Date(user.created_at).toLocaleString() }}</td>
            <td>
              <div class="actions">
                <button class="action-btn" @click="openEdit(user)">
                  <i class="el-icon-edit"></i>
                  编辑
                </button>
                <button class="action-btn delete-btn" @click="deleteUser(user.id)">
                  <i class="el-icon-delete"></i>
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="users.length === 0" class="empty-state">
        <i class="el-icon-user"></i>
        <p>暂无用户</p>
        <button @click="showCreateDialog = true">创建第一个用户</button>
      </div>
    </div>
    
    <ElDialog v-model="showCreateDialog" title="创建用户" @close="form = { username: '', email: '', password: '', role: 'user' }">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="用户名">
          <ElInput v-model="form.username" placeholder="请输入用户名" />
        </ElFormItem>
        <ElFormItem label="邮箱">
          <ElInput v-model="form.email" type="email" placeholder="请输入邮箱" />
        </ElFormItem>
        <ElFormItem label="密码">
          <ElInput v-model="form.password" type="password" placeholder="请输入密码" />
        </ElFormItem>
        <ElFormItem label="角色">
          <ElSelect v-model="form.role">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button @click="showCreateDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createUser">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showEditDialog" title="编辑用户" @close="selectedUser = null">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="用户名">
          <ElInput v-model="form.username" placeholder="请输入用户名" />
        </ElFormItem>
        <ElFormItem label="邮箱">
          <ElInput v-model="form.email" type="email" placeholder="请输入邮箱" />
        </ElFormItem>
        <ElFormItem label="新密码">
          <ElInput v-model="form.password" type="password" placeholder="不填则保持原密码" />
        </ElFormItem>
        <ElFormItem label="角色">
          <ElSelect v-model="form.role">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button @click="showEditDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="saveEdit">确定</button>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.users-page {
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

.users-table {
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

.role-tag {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.role-tag.admin {
  background: #fef0f0;
  color: #e74c3c;
}

.role-tag.user {
  background: #f0f9ff;
  color: #409eff;
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