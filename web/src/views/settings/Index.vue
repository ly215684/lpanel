<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { ElButton, ElCard, ElForm, ElFormItem, ElInput, ElMessage, ElAlert, ElSelect, ElOption } from 'element-plus'
import { getMeApi, updateMeApi, changePasswordApi, getSettingsApi, updateSettingsApi, type User, type PanelSettings } from '@/api'

const user = ref<User | null>(null)
const settings = ref<PanelSettings | null>(null)
const loading = ref(false)

const profileForm = reactive({
  username: '',
  currentPassword: ''
})

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const panelForm = reactive<{
  panelTitle: string
  panelDescription: string
  monitorInterval: number
  maxFileSize: number
  defaultTheme: string
}>({
  panelTitle: '',
  panelDescription: '',
  monitorInterval: 5000,
  maxFileSize: 52428800,
  defaultTheme: 'light'
})

async function loadUser() {
  loading.value = true
  try {
    user.value = await getMeApi()
    profileForm.username = user.value.username
  } catch (error: any) {
    ElMessage.error('获取用户信息失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

async function loadSettings() {
  loading.value = true
  try {
    const result = await getSettingsApi()
    settings.value = result
    panelForm.panelTitle = result.panelTitle
    panelForm.panelDescription = result.panelDescription
    panelForm.monitorInterval = Number(result.monitorInterval)
    panelForm.maxFileSize = Number(result.maxFileSize)
    panelForm.defaultTheme = result.defaultTheme
  } catch (error: any) {
    ElMessage.error('获取面板设置失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

async function handleUpdateProfile() {
  if (!profileForm.username) {
    ElMessage.error('请输入用户名')
    return
  }
  if (!profileForm.currentPassword) {
    ElMessage.error('请输入当前密码')
    return
  }

  loading.value = true
  try {
    await updateMeApi({
      username: profileForm.username,
      currentPassword: profileForm.currentPassword
    })
    ElMessage.success('用户名修改成功，请重新登录')
    
    setTimeout(() => {
      window.location.href = '/login'
    }, 2000)
  } catch (error: any) {
    ElMessage.error('修改失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

async function handleChangePassword() {
  if (!passwordForm.currentPassword) {
    ElMessage.error('请输入当前密码')
    return
  }
  if (!passwordForm.newPassword) {
    ElMessage.error('请输入新密码')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    ElMessage.error('新密码至少需要6个字符')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.error('两次输入的密码不一致')
    return
  }

  loading.value = true
  try {
    await changePasswordApi(passwordForm.currentPassword, passwordForm.newPassword)
    ElMessage.success('密码修改成功，请重新登录')
    
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''

    setTimeout(() => {
      window.location.href = '/login'
    }, 2000)
  } catch (error: any) {
    ElMessage.error('密码修改失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

async function handleUpdateSettings() {
  if (!panelForm.panelTitle) {
    ElMessage.error('请输入面板标题')
    return
  }

  loading.value = true
  try {
    await updateSettingsApi({
      panelTitle: panelForm.panelTitle,
      panelDescription: panelForm.panelDescription,
      monitorInterval: panelForm.monitorInterval,
      maxFileSize: panelForm.maxFileSize,
      defaultTheme: panelForm.defaultTheme
    })
    ElMessage.success('面板设置更新成功')
    loadSettings()
  } catch (error: any) {
    ElMessage.error('更新失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadUser()
  loadSettings()
})
</script>

<template>
  <div class="settings-page">
    <div class="page-header">
      <h2>设置</h2>
      <p>管理您的账户信息和面板配置</p>
    </div>

    <div class="settings-grid">
      <ElCard title="修改用户名" shadow="hover" class="setting-card">
        <ElAlert
          title="修改用户名后需要重新登录"
          type="warning"
          :closable="false"
          style="margin-bottom: 20px;"
        />
        <div v-if="loading" class="loading-text">加载中...</div>
        <div v-else>
          <ElForm :model="profileForm" label-width="120px">
            <ElFormItem label="新用户名">
              <ElInput v-model="profileForm.username" placeholder="请输入新用户名" />
            </ElFormItem>
            <ElFormItem label="当前密码">
              <ElInput v-model="profileForm.currentPassword" type="password" placeholder="请输入当前密码验证身份" show-password />
            </ElFormItem>
            <ElFormItem label="角色">
              <ElInput :value="user?.role === 'admin' ? '管理员' : '普通用户'" disabled />
            </ElFormItem>
            <ElFormItem label="创建时间">
              <ElInput :value="user?.created_at" disabled />
            </ElFormItem>
            <ElFormItem>
              <ElButton type="primary" :loading="loading" @click="handleUpdateProfile">修改用户名</ElButton>
            </ElFormItem>
          </ElForm>
        </div>
      </ElCard>

      <ElCard title="修改密码" shadow="hover" class="setting-card">
        <ElAlert
          title="修改密码后需要重新登录"
          type="warning"
          :closable="false"
          style="margin-bottom: 20px;"
        />
        <ElForm :model="passwordForm" label-width="120px">
          <ElFormItem label="当前密码">
            <ElInput v-model="passwordForm.currentPassword" type="password" placeholder="请输入当前密码" show-password />
          </ElFormItem>
          <ElFormItem label="新密码">
            <ElInput v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码（至少6个字符）" show-password />
          </ElFormItem>
          <ElFormItem label="确认新密码">
            <ElInput v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
          </ElFormItem>
          <ElFormItem>
            <ElButton type="primary" :loading="loading" @click="handleChangePassword">修改密码</ElButton>
          </ElFormItem>
        </ElForm>
      </ElCard>

      <ElCard title="面板设置" shadow="hover" class="setting-card">
        <ElAlert
          title="部分设置需要刷新页面才能生效"
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        />
        <div v-if="loading" class="loading-text">加载中...</div>
        <div v-else>
          <ElForm :model="panelForm" label-width="140px">
            <ElFormItem label="面板标题">
              <ElInput v-model="panelForm.panelTitle" placeholder="请输入面板标题" />
            </ElFormItem>
            <ElFormItem label="面板描述">
              <ElInput v-model="panelForm.panelDescription" placeholder="请输入面板描述" />
            </ElFormItem>
            <ElFormItem label="监控刷新间隔">
              <ElInput type="number" v-model.number="panelForm.monitorInterval" :min="1000" :max="60000" step="1000" />
              <span style="margin-left: 10px;">毫秒</span>
            </ElFormItem>
            <ElFormItem label="最大文件大小">
              <ElInput type="number" v-model.number="panelForm.maxFileSize" :min="1048576" :max="1073741824" step="1048576" />
              <span style="margin-left: 10px;">字节（约 {{ (panelForm.maxFileSize / 1024 / 1024).toFixed(0) }} MB）</span>
            </ElFormItem>
            <ElFormItem label="默认主题">
              <ElSelect v-model="panelForm.defaultTheme" placeholder="请选择主题">
                <ElOption label="亮色" value="light" />
                <ElOption label="暗色" value="dark" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem>
              <ElButton type="primary" :loading="loading" @click="handleUpdateSettings">保存设置</ElButton>
            </ElFormItem>
          </ElForm>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 5px 0;
  font-size: 24px;
}

.page-header p {
  margin: 0;
  color: #666;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.setting-card {
  max-width: 500px;
}

.loading-text {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>