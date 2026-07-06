<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listFilesApi, createDirectoryApi, deleteFileApi, readFileApi, writeFileApi, changePermissionsApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput } from 'element-plus'

interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  permissions: string
  owner: string
  group: string
  modifiedAt: string
}

const currentPath = ref('/var/www')
const files = ref<FileItem[]>([])
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showChmodDialog = ref(false)
const newFolderName = ref('')
const selectedFile = ref<FileItem | null>(null)
const fileContent = ref('')
const permissions = ref('755')

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function loadFiles() {
  try {
    files.value = await listFilesApi(currentPath.value)
  } catch {
    ElMessage.error('加载文件失败')
  }
}

function navigate(path: string) {
  if (path === '..') {
    const parts = currentPath.value.split('/').filter(p => p)
    parts.pop()
    currentPath.value = '/' + parts.join('/') || '/'
  } else {
    currentPath.value = path
  }
  loadFiles()
}

async function createFolder() {
  if (!newFolderName.value) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  try {
    await createDirectoryApi(`${currentPath.value}/${newFolderName.value}`)
    ElMessage.success('文件夹创建成功')
    showCreateDialog.value = false
    newFolderName.value = ''
    loadFiles()
  } catch {
    ElMessage.error('创建文件夹失败')
  }
}

async function deleteFile(file: FileItem) {
  try {
    await deleteFileApi(file.path)
    ElMessage.success('删除成功')
    loadFiles()
  } catch {
    ElMessage.error('删除失败')
  }
}

async function openFile(file: FileItem) {
  if (file.type !== 'file') return
  selectedFile.value = file
  try {
    const result = await readFileApi(file.path)
    fileContent.value = result.content
    showEditDialog.value = true
  } catch {
    ElMessage.error('读取文件失败')
  }
}

async function saveFile() {
  if (!selectedFile.value) return
  try {
    await writeFileApi(selectedFile.value.path, fileContent.value)
    ElMessage.success('保存成功')
    showEditDialog.value = false
  } catch {
    ElMessage.error('保存失败')
  }
}

async function openChmod(file: FileItem) {
  selectedFile.value = file
  permissions.value = file.permissions
  showChmodDialog.value = true
}

async function savePermissions() {
  if (!selectedFile.value) return
  try {
    await changePermissionsApi(selectedFile.value.path, permissions.value)
    ElMessage.success('权限修改成功')
    showChmodDialog.value = false
    loadFiles()
  } catch {
    ElMessage.error('权限修改失败')
  }
}

onMounted(() => {
  loadFiles()
})
</script>

<template>
  <div class="files-page">
    <div class="page-header">
      <div class="path-bar">
        <span class="path-item" @click="navigate('/')">/</span>
        <span v-for="(part, index) in currentPath.split('/').filter(p => p)" :key="index">
          <span class="path-separator">/</span>
          <span class="path-item" @click="navigate('/' + currentPath.split('/').filter(p => p).slice(0, index + 1).join('/'))">{{ part }}</span>
        </span>
      </div>
      <button class="create-btn" @click="showCreateDialog = true">
        <i class="el-icon-folder-add"></i>
        创建文件夹
      </button>
    </div>
    
    <div class="files-grid">
      <div 
        v-for="file in files" 
        :key="file.path" 
        class="file-card"
        :class="{ folder: file.type === 'directory' }"
        @click="file.type === 'directory' ? navigate(file.path) : openFile(file)"
      >
        <div class="file-icon">
          <i v-if="file.type === 'directory'" class="el-icon-folder"></i>
          <i v-else class="el-icon-document"></i>
        </div>
        <div class="file-name">{{ file.name }}</div>
        <div class="file-meta">
          <span>{{ file.type === 'directory' ? '文件夹' : formatBytes(file.size) }}</span>
          <span>{{ file.permissions }}</span>
        </div>
        <div class="file-actions">
          <button v-if="file.type === 'file'" class="action-btn" @click.stop="openChmod(file)">
            <i class="el-icon-lock"></i>
          </button>
          <button class="action-btn delete-btn" @click.stop="deleteFile(file)">
            <i class="el-icon-delete"></i>
          </button>
        </div>
      </div>
    </div>
    
    <ElDialog v-model="showCreateDialog" title="创建文件夹" @close="newFolderName = ''">
      <ElForm :model="{ name: newFolderName }" label-width="80px">
        <ElFormItem label="名称">
          <ElInput v-model="newFolderName" placeholder="请输入文件夹名称" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button @click="showCreateDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="createFolder">确定</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showEditDialog" :title="selectedFile?.name" width="60%">
      <textarea v-model="fileContent" class="file-editor" placeholder="文件内容"></textarea>
      <template #footer>
        <button @click="showEditDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="saveFile">保存</button>
      </template>
    </ElDialog>
    
    <ElDialog v-model="showChmodDialog" title="修改权限" @close="permissions = '755'">
      <ElForm :model="{ permissions }" label-width="80px">
        <ElFormItem label="权限">
          <ElInput v-model="permissions" placeholder="如 755" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <button @click="showChmodDialog = false">取消</button>
        <button class="el-button el-button--primary" @click="savePermissions">确定</button>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.files-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.path-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.path-item {
  cursor: pointer;
  color: #409eff;
  margin: 0 4px;
}

.path-item:hover {
  text-decoration: underline;
}

.path-separator {
  color: #999;
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

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.file-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  position: relative;
}

.file-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.file-card.folder {
  border: 2px solid #f0f0f0;
}

.file-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.folder .file-icon {
  color: #e6a23c;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  text-align: center;
  margin-bottom: 8px;
}

.file-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.file-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-card:hover .file-actions {
  opacity: 1;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #f5f5f5;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #e0e0e0;
}

.delete-btn:hover {
  background: #fef0f0;
  color: #e74c3c;
}

.file-editor {
  width: 100%;
  height: 400px;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-family: monospace;
  font-size: 14px;
  resize: none;
}

.file-editor:focus {
  outline: none;
  border-color: #409eff;
}
</style>
