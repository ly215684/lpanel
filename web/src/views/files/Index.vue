<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { listFilesApi, createDirectoryApi, deleteFileApi, readFileApi, writeFileApi, changePermissionsApi, searchFilesApi, downloadFileApi, uploadFileApi, renameFileApi, compressFileApi, compressFilesApi, extractFileApi } from '@/api'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElButton, ElPagination } from 'element-plus'
import { Search, Refresh, Upload, FolderAdd, Star, Share, Setting, Folder, Document, Delete, Grid, Lock, Edit, Download, ArrowRight, ArrowDown, FolderOpened, Picture, CopyDocument, Scissor, InfoFilled } from '@element-plus/icons-vue'
import MonacoEditor from '@/components/MonacoEditor.vue'

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

const currentPath = ref('/')
const files = ref<FileItem[]>([])
const searchKeyword = ref('')
const includeSubdirs = ref(false)
const isSearching = ref(false)

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showChmodDialog = ref(false)
const showRenameDialog = ref(false)
const showUploadDialog = ref(false)

const isDragging = ref(false)

const newFolderName = ref('')
const selectedFile = ref<FileItem | null>(null)
const fileContent = ref('')
const permissions = ref('755')
const newFileName = ref('')

const currentPage = ref(1)
const pageSize = ref(100)

const selectedFiles = ref<FileItem[]>([])
const copiedFiles = ref<{ items: FileItem[]; action: 'copy' | 'cut' } | null>(null)

const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTarget = ref<FileItem | null>(null)

const dragOverRow = ref<FileItem | null>(null)

const totalFiles = computed(() => files.value.length)
const directoryCount = computed(() => files.value.filter(f => f.type === 'directory').length)
const fileCount = computed(() => files.value.filter(f => f.type === 'file').length)

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString()
}

function getFileIcon(file: FileItem) {
  if (file.type === 'directory') return FolderOpened
  const ext = file.name.split('.').pop()?.toLowerCase()
  const icons: Record<string, any> = {
    'sh': Document,
    'yml': Document,
    'yaml': Document,
    'json': Document,
    'txt': Document,
    'ts': Document,
    'js': Document,
    'html': Document,
    'css': Document,
    'md': Document,
    'dat': Document,
    'dockerfile': Document,
    'gitignore': Document,
    'log': Document,
    'conf': Document,
    'config': Document,
    'xml': Document,
    'sql': Document,
    'py': Document,
    'go': Document,
    'rs': Document,
    'java': Document,
    'jar': Document,
    'zip': Document,
    'tar': Document,
    'gz': Document,
    'rar': Document,
    'png': Picture,
    'jpg': Picture,
    'jpeg': Picture,
    'gif': Picture,
    'svg': Picture,
    'pdf': Document,
    'doc': Document,
    'docx': Document,
    'xls': Document,
    'xlsx': Document
  }
  return icons[ext || ''] || Document
}

function getFileIconColor(file: FileItem): string {
  if (file.type === 'directory') return '#409eff'
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext || '')) return '#67c23a'
  if (['zip', 'tar', 'gz', 'rar'].includes(ext || '')) return '#e6a23c'
  if (['sh', 'py', 'js', 'ts', 'go', 'rs', 'java'].includes(ext || '')) return '#909399'
  return '#909399'
}

function isCompressedFile(file: FileItem): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ['zip', 'tar', 'gz', 'rar'].includes(ext || '')
}

async function loadFiles() {
  isSearching.value = false
  try {
    files.value = await listFilesApi(currentPath.value)
    currentPage.value = 1
  } catch {
    ElMessage.error('加载文件失败')
  }
}

async function handleSearch() {
  if (!searchKeyword.value.trim()) {
    loadFiles()
    return
  }
  isSearching.value = true
  try {
    files.value = await searchFilesApi(searchKeyword.value.trim(), currentPath.value, includeSubdirs.value)
    currentPage.value = 1
  } catch {
    ElMessage.error('搜索失败')
  }
}

function navigate(path: string) {
  currentPath.value = path
  searchKeyword.value = ''
  loadFiles()
}

function goBack() {
  if (currentPath.value === '/') return
  const parts = currentPath.value.split('/').filter(p => p)
  parts.pop()
  currentPath.value = '/' + parts.join('/') || '/'
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

async function deleteFileItem(file: FileItem) {
  closeContextMenu()
  try {
    await deleteFileApi(file.path)
    ElMessage.success('删除成功')
    loadFiles()
  } catch {
    ElMessage.error('删除失败')
  }
}

async function deleteSelectedFiles() {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请选择要删除的文件')
    return
  }
  
  let successCount = 0
  let failCount = 0
  
  for (const file of selectedFiles.value) {
    try {
      await deleteFileApi(file.path)
      successCount++
    } catch {
      failCount++
    }
  }
  
  if (successCount > 0) {
    ElMessage.success(`${successCount} 个文件删除成功`)
    loadFiles()
  }
  if (failCount > 0) {
    ElMessage.error(`${failCount} 个文件删除失败`)
  }
  
  selectedFiles.value = []
}

async function openFile(file: FileItem) {
  if (file.type !== 'file') return
  selectedFile.value = file
  closeContextMenu()
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
  closeContextMenu()
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

async function openRename(file: FileItem) {
  selectedFile.value = file
  newFileName.value = file.name
  closeContextMenu()
  showRenameDialog.value = true
}

async function saveRename() {
  if (!selectedFile.value || !newFileName.value) return
  try {
    await renameFileApi(selectedFile.value.path, newFileName.value)
    ElMessage.success('重命名成功')
    showRenameDialog.value = false
    loadFiles()
  } catch {
    ElMessage.error('重命名失败')
  }
}

async function handleUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return
  
  const items = Array.from(files).map(file => ({ file, relativePath: '' }))
  await uploadFiles(items, currentPath.value)
  target.value = ''
  showUploadDialog.value = false
}

interface UploadFileItem {
  file: File
  relativePath: string
}

async function uploadFiles(items: UploadFileItem[], targetPath: string) {
  let successCount = 0
  let failCount = 0
  
  for (const item of items) {
    try {
      await uploadFileApi(item.file, targetPath, item.relativePath)
      successCount++
    } catch {
      failCount++
    }
  }
  
  if (successCount > 0) {
    ElMessage.success(`${successCount} 个文件上传成功`)
    loadFiles()
  }
  if (failCount > 0) {
    ElMessage.error(`${failCount} 个文件上传失败`)
  }
}

async function readEntriesRecursive(entry: FileSystemEntry, relativePath: string = ''): Promise<UploadFileItem[]> {
  const items: UploadFileItem[] = []
  
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject)
    })
    items.push({ file, relativePath })
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry
    const reader = dirEntry.createReader()
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    
    for (const childEntry of entries) {
      const childRelativePath = relativePath ? `${relativePath}/${childEntry.name}` : childEntry.name
      const childItems = await readEntriesRecursive(childEntry, childRelativePath)
      items.push(...childItems)
    }
  }
  
  return items
}

async function processDropFiles(dataTransfer: DataTransfer): Promise<UploadFileItem[]> {
  const items: UploadFileItem[] = []
  
  for (let i = 0; i < dataTransfer.items.length; i++) {
    const item = dataTransfer.items[i]
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.()
      if (entry) {
        const entryItems = await readEntriesRecursive(entry)
        items.push(...entryItems)
      } else {
        const file = item.getAsFile()
        if (file) {
          items.push({ file, relativePath: '' })
        }
      }
    }
  }
  
  return items
}

function onDragEnter(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (e.clientX <= rect.left || e.clientX >= rect.right ||
      e.clientY <= rect.top || e.clientY >= rect.bottom) {
    isDragging.value = false
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  
  document.querySelectorAll('.drag-over-row').forEach(el => el.classList.remove('drag-over-row'))
  
  const pointTarget = document.elementFromPoint(e.clientX, e.clientY)
  if (!pointTarget) {
    dragOverRow.value = null
    return
  }
  
  const rowEl = pointTarget.closest('.el-table__row') as HTMLElement | null
  if (rowEl) {
    const rowIndex = Array.from(rowEl.parentElement?.children || []).indexOf(rowEl)
    const row = files.value[rowIndex]
    if (row && row.type === 'directory') {
      dragOverRow.value = row
      rowEl.classList.add('drag-over-row')
      return
    }
  }
  
  dragOverRow.value = null
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false
  
  document.querySelectorAll('.drag-over-row').forEach(el => el.classList.remove('drag-over-row'))
  
  let targetPath = currentPath.value
  
  const pointTarget = document.elementFromPoint(e.clientX, e.clientY)
  if (pointTarget) {
    const rowEl = pointTarget.closest('.el-table__row') as HTMLElement | null
    if (rowEl) {
      const rowIndex = Array.from(rowEl.parentElement?.children || []).indexOf(rowEl)
      const row = files.value[rowIndex]
      if (row && row.type === 'directory') {
        targetPath = row.path
      }
    }
  }
  
  dragOverRow.value = null
  
  const dataTransfer = e.dataTransfer
  if (!dataTransfer || dataTransfer.items.length === 0) return
  
  const items = await processDropFiles(dataTransfer)
  uploadFiles(items, targetPath)
}

async function handleDownload(file: FileItem) {
  closeContextMenu()
  try {
    const response = await downloadFileApi(file.path)
    const url = window.URL.createObjectURL(new Blob([(response as any).data || response]))
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('下载失败')
  }
}

async function handleCompress(file?: FileItem) {
  try {
    if (selectedFiles.value.length > 0) {
      const paths = selectedFiles.value.map(f => f.path)
      await compressFilesApi(paths)
      ElMessage.success(`${selectedFiles.value.length} 个文件压缩成功`)
    } else if (file || contextMenuTarget.value) {
      const targetFile = file || contextMenuTarget.value
      if (targetFile) {
        await compressFileApi(targetFile.path)
        ElMessage.success('压缩成功')
      }
    }
    loadFiles()
    closeContextMenu()
  } catch {
    ElMessage.error('压缩失败')
  }
}

async function handleExtract(file: FileItem) {
  closeContextMenu()
  try {
    await extractFileApi(file.path)
    ElMessage.success('解压成功')
    loadFiles()
  } catch {
    ElMessage.error('解压失败')
  }
}

function handleCopy() {
  if (selectedFiles.value.length > 0) {
    copiedFiles.value = { items: selectedFiles.value, action: 'copy' }
    ElMessage.success(`已复制 ${selectedFiles.value.length} 个文件`)
    closeContextMenu()
  } else if (contextMenuTarget.value) {
    copiedFiles.value = { items: [contextMenuTarget.value], action: 'copy' }
    ElMessage.success('已复制')
    closeContextMenu()
  }
}

function handleCut() {
  if (selectedFiles.value.length > 0) {
    copiedFiles.value = { items: selectedFiles.value, action: 'cut' }
    ElMessage.success(`已剪切 ${selectedFiles.value.length} 个文件`)
    closeContextMenu()
  } else if (contextMenuTarget.value) {
    copiedFiles.value = { items: [contextMenuTarget.value], action: 'cut' }
    ElMessage.success('已剪切')
    closeContextMenu()
  }
}

async function handlePaste() {
  if (!copiedFiles.value || copiedFiles.value.items.length === 0) {
    ElMessage.warning('没有可粘贴的文件')
    closeContextMenu()
    return
  }
  
  let successCount = 0
  let failCount = 0
  
  for (const file of copiedFiles.value.items) {
    const newPath = `${currentPath.value}/${file.name}`
    
    try {
      if (copiedFiles.value.action === 'copy') {
        if (file.type === 'directory') {
          await executeCopyDirectory(file.path, newPath)
        } else {
          const content = await downloadFileApi(file.path)
          const buffer = (content as any).data || content
          await uploadFileApi(new File([buffer], file.name), currentPath.value)
        }
      } else {
        await renameFileApi(file.path, newPath)
      }
      successCount++
    } catch {
      failCount++
    }
  }
  
  if (successCount > 0) {
    ElMessage.success(`${successCount} 个文件${copiedFiles.value.action === 'copy' ? '复制' : '移动'}成功`)
    loadFiles()
  }
  if (failCount > 0) {
    ElMessage.error(`${failCount} 个文件${copiedFiles.value.action === 'copy' ? '复制' : '移动'}失败`)
  }
  
  copiedFiles.value = null
  closeContextMenu()
}

async function executeCopyDirectory(source: string, destination: string) {
  const sourceFiles = await listFilesApi(source)
  await createDirectoryApi(destination)
  
  for (const file of sourceFiles) {
    const newPath = `${destination}/${file.name}`
    if (file.type === 'directory') {
      await executeCopyDirectory(file.path, newPath)
    } else {
      const content = await downloadFileApi(file.path)
      const buffer = (content as any).data || content
      await uploadFileApi(new File([buffer], file.name), destination)
    }
  }
}

function handleCopyPath() {
  if (selectedFiles.value.length > 0) {
    const paths = selectedFiles.value.map(f => f.path).join('\n')
    navigator.clipboard.writeText(paths)
    ElMessage.success(`已复制 ${selectedFiles.value.length} 个文件路径`)
    closeContextMenu()
  } else if (contextMenuTarget.value) {
    navigator.clipboard.writeText(contextMenuTarget.value.path)
    ElMessage.success('路径已复制到剪贴板')
    closeContextMenu()
  }
}

function handleProperties(file: FileItem) {
  closeContextMenu()
  ElMessage.info(`名称: ${file.name}\n路径: ${file.path}\n大小: ${file.type === 'directory' ? '-' : formatBytes(file.size)}\n权限: ${file.permissions}`)
}

function handleContextMenu(e: MouseEvent, row: FileItem, _column: any) {
  e.preventDefault()
  
  const isSelected = selectedFiles.value.some(f => f.path === row.path)
  if (!isSelected) {
    selectedFiles.value = [row]
  }
  
  contextMenuTarget.value = row
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

function handleTableContextMenu(e: MouseEvent) {
  e.preventDefault()
  contextMenuTarget.value = null
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
}

function handleSelectionChange(selection: FileItem[]) {
  selectedFiles.value = selection
}

function handleRowClick(row: FileItem) {
  if (row.type === 'directory') {
    navigate(row.path)
  } else if (isCompressedFile(row)) {
    handleExtract(row)
  } else {
    openFile(row)
  }
}

function handleActionClick(e: Event, row: FileItem) {
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  contextMenuTarget.value = row
  contextMenuPosition.value = { x: rect.left, y: rect.bottom + 4 }
  contextMenuVisible.value = true
}

function handleClickOutside(e: MouseEvent) {
  if (!contextMenuVisible.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.context-menu')) {
    closeContextMenu()
  }
}

onMounted(() => {
  loadFiles()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="files-page">
    <div class="path-bar">
      <button class="nav-btn" @click="goBack" :disabled="currentPath === '/'">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="path-item" @click="navigate('/')">根目录</span>
      <template v-if="currentPath !== '/'">
        <span v-for="(part, index) in currentPath.split('/').filter(p => p)" :key="index">
          <span class="path-separator">></span>
          <span class="path-item" @click="navigate('/' + currentPath.split('/').filter(p => p).slice(0, index + 1).join('/'))">{{ part }}</span>
        </span>
      </template>
      <button class="refresh-btn" @click="loadFiles">
        <Refresh />
      </button>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <button class="toolbar-btn upload-btn" @click="showUploadDialog = true">
          <Upload />
          <span>上传</span>
        </button>
        <button class="toolbar-btn" @click="showCreateDialog = true">
          <FolderAdd />
          <span>新建</span>
        </button>
        <button class="toolbar-btn" @click="handleSearch">
          <Search />
          <span>搜索文件内容</span>
        </button>
        <button class="toolbar-btn">
          <Star />
          <span>收藏</span>
        </button>
        <button class="toolbar-btn">
          <Share />
          <span>分享列表</span>
        </button>
        <button class="toolbar-btn">
          <Setting />
          <span>终端</span>
        </button>
        <button class="toolbar-btn">
          <Folder />
          <span>根目录</span>
        </button>
        <button class="toolbar-btn" @click="handlePaste" :disabled="!copiedFiles">
          <FolderOpened />
          <span>粘贴</span>
        </button>
      </div>
      <div class="toolbar-right">
        <button class="toolbar-btn">
          <Document />
          <span>备份</span>
        </button>
        <button class="toolbar-btn">
          <Delete />
          <span>回收站</span>
        </button>
        <button class="toolbar-btn layout-btn">
          <Grid />
        </button>
      </div>
    </div>

    <div class="search-bar">
      <div class="search-input-wrapper">
        <Search class="search-icon" />
        <input 
          v-model="searchKeyword" 
          type="text" 
          class="search-input" 
          placeholder="搜索文件"
          @keyup.enter="handleSearch"
        />
        <label class="search-checkbox">
          <input v-model="includeSubdirs" type="checkbox" />
          <span>包含子目录</span>
        </label>
        <button class="search-btn" @click="handleSearch">
          <Search />
        </button>
      </div>
    </div>

    <div 
      class="table-container"
      :class="{ dragging: isDragging }"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <el-table 
        :data="files" 
        class="files-table"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        @row-contextmenu="handleContextMenu"
        @contextmenu="handleTableContextMenu"

      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="name" label="文件名" min-width="200">
          <template #default="scope">
            <div class="file-name-cell">
              <component :is="getFileIcon(scope.row as FileItem)" :style="{ color: getFileIconColor(scope.row as FileItem) }" />
              <span>{{ (scope.row as FileItem).name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="受保护" width="80">
          <template #default>
            <span class="protected-tag">
              <Lock />
              <span>未保护</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="permissions" label="权限" width="80">
          <template #default="scope">
            <span>{{ (scope.row as FileItem).permissions }} / {{ (scope.row as FileItem).owner }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小" width="120">
          <template #default="scope">
            <span>{{ (scope.row as FileItem).type === 'directory' ? '-' : formatBytes((scope.row as FileItem).size) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="modifiedAt" label="修改时间" width="180">
          <template #default="scope">
            <span>{{ formatDate((scope.row as FileItem).modifiedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" width="100">
          <template #default>
            <span>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="scope">
            <button class="action-btn" @click="(e: Event) => handleActionClick(e, scope.row as FileItem)">
              <span>操作</span>
              <ArrowDown />
            </button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="footer">
      <div class="footer-info">
        <span>总共{{ directoryCount }}个目录，{{ fileCount }}个文件</span>
        <span v-if="selectedFiles.length > 0" class="selected-info">| 已选择 {{ selectedFiles.length }} 个文件</span>
      </div>
      <div class="pagination-wrapper">
        <ElPagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="totalFiles"
          :page-sizes="[50, 100, 200]"
          layout="prev, pager, next, jumper, ->, total"
        />
      </div>
    </div>

    <ElDialog v-model="showCreateDialog" title="新建文件夹" @close="newFolderName = ''">
      <ElForm :model="{ name: newFolderName }" label-width="80px">
        <ElFormItem label="名称">
          <ElInput v-model="newFolderName" placeholder="请输入文件夹名称" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="showCreateDialog = false">取消</ElButton>
        <ElButton type="primary" @click="createFolder">确定</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="showEditDialog" :title="selectedFile?.name" width="80%" top="5vh">
      <MonacoEditor v-model="fileContent" :file-name="selectedFile?.name" height="550px" />
      <template #footer>
        <ElButton @click="showEditDialog = false">取消</ElButton>
        <ElButton type="primary" @click="saveFile">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="showChmodDialog" title="修改权限" @close="permissions = '755'">
      <ElForm :model="{ permissions }" label-width="80px">
        <ElFormItem label="权限">
          <ElInput v-model="permissions" placeholder="如 755" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="showChmodDialog = false">取消</ElButton>
        <ElButton type="primary" @click="savePermissions">确定</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="showRenameDialog" title="重命名" @close="newFileName = ''">
      <ElForm :model="{ name: newFileName }" label-width="80px">
        <ElFormItem label="新名称">
          <ElInput v-model="newFileName" placeholder="请输入新名称" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="showRenameDialog = false">取消</ElButton>
        <ElButton type="primary" @click="saveRename">确定</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="showUploadDialog" title="上传文件" @close="true">
      <div 
        class="upload-area"
        :class="{ dragging: isDragging }"
        @dragenter="onDragEnter"
        @dragleave="onDragLeave"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        <input type="file" class="upload-input" @change="handleUpload" multiple />
        <div class="upload-hint">
          <Upload />
          <span>{{ isDragging ? '释放以上传文件' : '点击或拖拽文件到此处上传' }}</span>
          <span class="upload-hint-sub">支持多选文件</span>
        </div>
      </div>
      <template #footer>
        <ElButton @click="showUploadDialog = false">取消</ElButton>
      </template>
    </ElDialog>

    <Teleport to="body">
      <div 
        v-if="contextMenuVisible" 
        class="context-menu"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
        @click.stop
      >
        <template v-if="contextMenuTarget">
          <button v-if="contextMenuTarget.type === 'file'" @click="openFile(contextMenuTarget)">
            <Edit />
            <span>编辑</span>
          </button>
          <button @click="handleDownload(contextMenuTarget)">
            <Download />
            <span>下载</span>
          </button>
          <button @click="handleCopy">
            <CopyDocument />
            <span>复制</span>
          </button>
          <button @click="handleCut">
            <Scissor />
            <span>剪切</span>
          </button>
          <button @click="handleCopyPath">
            <CopyDocument />
            <span>Copy Path</span>
          </button>
          <button @click="openRename(contextMenuTarget)">
            <ArrowRight />
            <span>重命名</span>
          </button>
          <button @click="openChmod(contextMenuTarget)">
            <Lock />
            <span>权限</span>
          </button>
          <button @click="handleCompress(contextMenuTarget)">
            <Document />
            <span>压缩</span>
          </button>
          <button v-if="isCompressedFile(contextMenuTarget)" @click="handleExtract(contextMenuTarget)">
            <FolderOpened />
            <span>解压</span>
          </button>
          <div class="menu-divider" v-if="selectedFiles.length > 0"></div>
          <button v-if="selectedFiles.length > 0" @click="deleteSelectedFiles">
            <Delete />
            <span>删除选中文件</span>
          </button>
          <div class="menu-divider"></div>
          <button class="delete-action" @click="deleteFileItem(contextMenuTarget)">
            <Delete />
            <span>删除</span>
          </button>
          <button @click="handleProperties(contextMenuTarget)">
            <InfoFilled />
            <span>属性</span>
          </button>
        </template>
        <template v-else>
          <button v-if="selectedFiles.length > 0" @click="handleCompress()">
            <Document />
            <span>压缩选中文件</span>
          </button>
          <button v-if="copiedFiles" @click="handlePaste">
            <FolderOpened />
            <span>粘贴</span>
          </button>
          <button @click="showCreateDialog = true; closeContextMenu()">
            <FolderAdd />
            <span>新建文件夹</span>
          </button>
          <button v-if="selectedFiles.length > 0" @click="deleteSelectedFiles">
            <Delete />
            <span>删除选中文件</span>
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.files-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f5f7fa;
  padding: 16px;
  min-height: 100vh;
}

.path-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 10px 16px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.nav-btn, .refresh-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.nav-btn:hover, .refresh-btn:hover {
  background: #e0e0e0;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.path-separator {
  color: #999;
  font-size: 12px;
}

.path-item {
  cursor: pointer;
  color: #409eff;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
}

.path-item:hover {
  background: #ecf5ff;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 10px 16px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.toolbar-left, .toolbar-right {
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  transition: all 0.2s;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f5f7fa;
  border-color: #c0c4cc;
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-btn {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

.upload-btn:hover {
  background: #66b1ff;
  border-color: #66b1ff;
}

.layout-btn {
  border: none;
  background: #f0f0f0;
}

.search-bar {
  background: #fff;
  padding: 10px 16px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-icon {
  color: #999;
  font-size: 16px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.search-input:focus {
  border-color: #409eff;
}

.search-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
}

.search-btn {
  width: 36px;
  height: 32px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn:hover {
  background: #66b1ff;
}

.table-container {
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.files-table {
  width: 100%;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.file-name-cell:hover {
  color: #409eff;
}

.protected-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: none;
  color: #409eff;
  cursor: pointer;
  font-size: 13px;
}

.action-btn:hover {
  background: #ecf5ff;
  border-radius: 4px;
}

.context-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 140px;
  padding: 4px 0;
}

.context-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  text-align: left;
  transition: background 0.2s;
}

.context-menu button:hover {
  background: #f5f7fa;
}

.menu-divider {
  height: 1px;
  background: #e4e7ed;
  margin: 4px 0;
}

.delete-action:hover {
  background: #fef0f0 !important;
  color: #e74c3c !important;
}

.table-container.dragging {
  border: 2px dashed #409eff;
  background: #ecf5ff;
}

:deep(.drag-over-row) {
  background-color: #ecf5ff !important;
  box-shadow: inset 0 0 0 2px #409eff;
}

:deep(.drag-over-row > td) {
  background-color: #ecf5ff !important;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 10px 16px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.footer-info {
  font-size: 13px;
  color: #666;
}

.selected-info {
  color: #409eff;
}

.pagination-wrapper {
  display: flex;
  align-items: center;
}



.upload-area {
  position: relative;
  height: 120px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.upload-area:hover {
  border-color: #409eff;
}

.upload-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.upload-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #999;
}

.upload-hint i {
  font-size: 32px;
}

.upload-hint span {
  font-size: 14px;
}

.upload-hint-sub {
  font-size: 12px !important;
  color: #bbb !important;
}

.upload-area.dragging {
  border-color: #409eff;
  background: #ecf5ff;
}

:deep(svg) {
  width: 16px;
  height: 16px;
}

.file-name-cell :deep(svg) {
  width: 18px;
  height: 18px;
}

.drop-zone :deep(svg),
.upload-hint :deep(svg) {
  width: 24px;
  height: 24px;
}
</style>