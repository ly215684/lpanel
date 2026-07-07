<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElButton, ElCard, ElBadge, ElMessage, ElSelect, ElOption, ElScrollbar } from 'element-plus'
import { getServicesStatusApi, installDockerApi, installDockerComposeApi, installNginxApi, installApacheApi, installPHPApi, installMySQLApi, type SystemServices } from '@/api'

const services = ref<SystemServices | null>(null)
const loading = ref(false)

const installing = ref<Record<string, boolean>>({
  docker: false,
  compose: false,
  nginx: false,
  apache: false,
  php: false,
  mysql: false
})

const installationLogs = ref<Record<string, string[]>>({
  docker: [],
  compose: [],
  nginx: [],
  apache: [],
  php: [],
  mysql: []
})

const showLogs = ref<Record<string, boolean>>({
  docker: false,
  compose: false,
  nginx: false,
  apache: false,
  php: false,
  mysql: false
})

const phpVersion = ref('8.3')
const phpVersions = ['7.4', '8.0', '8.1', '8.2', '8.3']

const dockerMirror = ref<'official' | 'aliyun' | 'daocloud'>('official')
const dockerMirrors = [
  { value: 'official', label: '官方镜像' },
  { value: 'aliyun', label: '阿里云镜像' },
  { value: 'daocloud', label: 'DaoCloud镜像' }
]

async function loadServices() {
  loading.value = true
  try {
    services.value = await getServicesStatusApi()
  } catch (error: any) {
    ElMessage.error('获取服务状态失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

async function handleInstall(service: string) {
  installing.value[service] = true
  showLogs.value[service] = true
  installationLogs.value[service] = []
  
  try {
    const onLog = (log: string) => {
      installationLogs.value[service].push(log)
    }
    
    let result: { success: boolean; message: string }
    
    switch (service) {
      case 'docker':
        result = await installDockerApi(dockerMirror.value, onLog)
        break
      case 'compose':
        result = await installDockerComposeApi(onLog)
        break
      case 'nginx':
        result = await installNginxApi(onLog)
        break
      case 'apache':
        result = await installApacheApi(onLog)
        break
      case 'php':
        result = await installPHPApi(phpVersion.value, onLog)
        break
      case 'mysql':
        result = await installMySQLApi(onLog)
        break
      default:
        throw new Error('未知服务')
    }
    
    if (result.success) {
      ElMessage.success(result.message)
      await loadServices()
    } else {
      ElMessage.error(result.message)
    }
  } catch (error: any) {
    installationLogs.value[service].push(`[ERROR] ${error.message}`)
    ElMessage.error('安装失败: ' + error.message)
  } finally {
    installing.value[service] = false
  }
}

type BadgeType = 'success' | 'danger' | 'warning' | 'info' | 'primary'

function getStatusBadge(status: boolean, type: 'installed' | 'running') {
  const text = type === 'installed' ? (status ? '已安装' : '未安装') : (status ? '运行中' : '已停止')
  const badgeType: BadgeType = status ? 'success' : (type === 'installed' ? 'danger' : 'warning')
  return { text, badgeType }
}

function toggleLogs(service: string) {
  showLogs.value[service] = !showLogs.value[service]
}

function getLogClass(log: string): string {
  if (log.includes('[ERROR]')) return 'log-error'
  if (log.includes('[SUCCESS]')) return 'log-success'
  if (log.includes('[STEP]')) return 'log-step'
  if (log.includes('[DONE]')) return 'log-done'
  if (log.includes('[INFO]')) return 'log-info'
  return 'log-default'
}

onMounted(() => {
  loadServices()
})
</script>

<template>
  <div class="system-page">
    <div class="page-header">
      <h2>系统管理</h2>
      <p>管理服务器上的系统服务和环境</p>
    </div>

    <div class="services-grid">
      <ElCard title="Docker" shadow="hover" class="service-card">
        <div v-if="loading" class="loading-text">加载中...</div>
        <div v-else-if="services?.docker" class="service-status">
          <div class="status-row">
            <span class="status-label">安装状态</span>
            <ElBadge :value="getStatusBadge(services.docker.installed, 'installed').text" :type="getStatusBadge(services.docker.installed, 'installed').badgeType" />
          </div>
          <div v-if="services.docker.version" class="status-row">
            <span class="status-label">版本</span>
            <span class="status-value">{{ services.docker.version }}</span>
          </div>
          <div class="status-row">
            <span class="status-label">运行状态</span>
            <ElBadge :value="getStatusBadge(services.docker.running, 'running').text" :type="getStatusBadge(services.docker.running, 'running').badgeType" />
          </div>
          <div class="status-row">
            <span class="status-label">Docker Compose</span>
            <ElBadge :value="getStatusBadge(services.docker.composeInstalled, 'installed').text" :type="getStatusBadge(services.docker.composeInstalled, 'installed').badgeType" />
          </div>
        </div>

        <div class="action-buttons">
          <div v-if="!services?.docker.installed" class="install-with-select">
            <ElSelect v-model="dockerMirror" placeholder="选择镜像源" style="width: 140px; margin-right: 10px;">
              <ElOption v-for="mirror in dockerMirrors" :key="mirror.value" :label="mirror.label" :value="mirror.value" />
            </ElSelect>
            <ElButton type="primary" :loading="installing.docker" @click="handleInstall('docker')">安装 Docker</ElButton>
          </div>
          <ElButton v-if="services?.docker.installed && !services?.docker.composeInstalled" type="primary" :loading="installing.compose" @click="handleInstall('compose')">安装 Compose</ElButton>
          <ElButton v-if="services?.docker.installed && services?.docker.composeInstalled" type="success" disabled>已安装</ElButton>
          <ElButton v-if="installationLogs.docker.length > 0" type="text" @click="toggleLogs('docker')">
            {{ showLogs.docker ? '隐藏日志' : '查看日志' }}
          </ElButton>
        </div>

        <div v-if="showLogs.docker && installationLogs.docker.length > 0" class="installation-logs">
          <ElScrollbar height="200px" class="logs-scroll">
            <div class="logs-content">
              <div v-for="(log, index) in installationLogs.docker" :key="index" :class="getLogClass(log)">
                {{ log }}
              </div>
            </div>
          </ElScrollbar>
        </div>
      </ElCard>

      <ElCard title="Nginx" shadow="hover" class="service-card">
        <div v-if="loading" class="loading-text">加载中...</div>
        <div v-else-if="services?.nginx" class="service-status">
          <div class="status-row">
            <span class="status-label">安装状态</span>
            <ElBadge :value="getStatusBadge(services.nginx.installed, 'installed').text" :type="getStatusBadge(services.nginx.installed, 'installed').badgeType" />
          </div>
          <div v-if="services.nginx.version" class="status-row">
            <span class="status-label">版本</span>
            <span class="status-value">{{ services.nginx.version }}</span>
          </div>
          <div class="status-row">
            <span class="status-label">运行状态</span>
            <ElBadge :value="getStatusBadge(services.nginx.running, 'running').text" :type="getStatusBadge(services.nginx.running, 'running').badgeType" />
          </div>
        </div>

        <div class="action-buttons">
          <ElButton v-if="!services?.nginx.installed" type="primary" :loading="installing.nginx" @click="handleInstall('nginx')">安装 Nginx</ElButton>
          <ElButton v-else type="success" disabled>已安装</ElButton>
          <ElButton v-if="installationLogs.nginx.length > 0" type="text" @click="toggleLogs('nginx')">
            {{ showLogs.nginx ? '隐藏日志' : '查看日志' }}
          </ElButton>
        </div>

        <div v-if="showLogs.nginx && installationLogs.nginx.length > 0" class="installation-logs">
          <ElScrollbar height="200px" class="logs-scroll">
            <div class="logs-content">
              <div v-for="(log, index) in installationLogs.nginx" :key="index" :class="getLogClass(log)">
                {{ log }}
              </div>
            </div>
          </ElScrollbar>
        </div>
      </ElCard>

      <ElCard title="Apache" shadow="hover" class="service-card">
        <div v-if="loading" class="loading-text">加载中...</div>
        <div v-else-if="services?.apache" class="service-status">
          <div class="status-row">
            <span class="status-label">安装状态</span>
            <ElBadge :value="getStatusBadge(services.apache.installed, 'installed').text" :type="getStatusBadge(services.apache.installed, 'installed').badgeType" />
          </div>
          <div v-if="services.apache.version" class="status-row">
            <span class="status-label">版本</span>
            <span class="status-value">{{ services.apache.version }}</span>
          </div>
          <div class="status-row">
            <span class="status-label">运行状态</span>
            <ElBadge :value="getStatusBadge(services.apache.running, 'running').text" :type="getStatusBadge(services.apache.running, 'running').badgeType" />
          </div>
        </div>

        <div class="action-buttons">
          <ElButton v-if="!services?.apache.installed" type="primary" :loading="installing.apache" @click="handleInstall('apache')">安装 Apache</ElButton>
          <ElButton v-else type="success" disabled>已安装</ElButton>
          <ElButton v-if="installationLogs.apache.length > 0" type="text" @click="toggleLogs('apache')">
            {{ showLogs.apache ? '隐藏日志' : '查看日志' }}
          </ElButton>
        </div>

        <div v-if="showLogs.apache && installationLogs.apache.length > 0" class="installation-logs">
          <ElScrollbar height="200px" class="logs-scroll">
            <div class="logs-content">
              <div v-for="(log, index) in installationLogs.apache" :key="index" :class="getLogClass(log)">
                {{ log }}
              </div>
            </div>
          </ElScrollbar>
        </div>
      </ElCard>

      <ElCard title="PHP" shadow="hover" class="service-card">
        <div v-if="loading" class="loading-text">加载中...</div>
        <div v-else-if="services?.php" class="service-status">
          <div class="status-row">
            <span class="status-label">安装状态</span>
            <ElBadge :value="getStatusBadge(services.php.installed, 'installed').text" :type="getStatusBadge(services.php.installed, 'installed').badgeType" />
          </div>
          <div v-if="services.php.version" class="status-row">
            <span class="status-label">版本</span>
            <span class="status-value">{{ services.php.version }}</span>
          </div>
          <div class="status-row">
            <span class="status-label">运行状态</span>
            <ElBadge :value="getStatusBadge(services.php.running, 'running').text" :type="getStatusBadge(services.php.running, 'running').badgeType" />
          </div>
        </div>

        <div class="action-buttons">
          <div v-if="!services?.php.installed" class="install-with-select">
            <ElSelect v-model="phpVersion" placeholder="选择版本" style="width: 120px; margin-right: 10px;">
              <ElOption v-for="v in phpVersions" :key="v" :label="v" :value="v" />
            </ElSelect>
            <ElButton type="primary" :loading="installing.php" @click="handleInstall('php')">安装 PHP</ElButton>
          </div>
          <ElButton v-else type="success" disabled>已安装</ElButton>
          <ElButton v-if="installationLogs.php.length > 0" type="text" @click="toggleLogs('php')">
            {{ showLogs.php ? '隐藏日志' : '查看日志' }}
          </ElButton>
        </div>

        <div v-if="showLogs.php && installationLogs.php.length > 0" class="installation-logs">
          <ElScrollbar height="200px" class="logs-scroll">
            <div class="logs-content">
              <div v-for="(log, index) in installationLogs.php" :key="index" :class="getLogClass(log)">
                {{ log }}
              </div>
            </div>
          </ElScrollbar>
        </div>
      </ElCard>

      <ElCard title="MySQL" shadow="hover" class="service-card">
        <div v-if="loading" class="loading-text">加载中...</div>
        <div v-else-if="services?.mysql" class="service-status">
          <div class="status-row">
            <span class="status-label">安装状态</span>
            <ElBadge :value="getStatusBadge(services.mysql.installed, 'installed').text" :type="getStatusBadge(services.mysql.installed, 'installed').badgeType" />
          </div>
          <div v-if="services.mysql.version" class="status-row">
            <span class="status-label">版本</span>
            <span class="status-value">{{ services.mysql.version }}</span>
          </div>
          <div class="status-row">
            <span class="status-label">运行状态</span>
            <ElBadge :value="getStatusBadge(services.mysql.running, 'running').text" :type="getStatusBadge(services.mysql.running, 'running').badgeType" />
          </div>
        </div>

        <div class="action-buttons">
          <ElButton v-if="!services?.mysql.installed" type="primary" :loading="installing.mysql" @click="handleInstall('mysql')">安装 MySQL</ElButton>
          <ElButton v-else type="success" disabled>已安装</ElButton>
          <ElButton v-if="installationLogs.mysql.length > 0" type="text" @click="toggleLogs('mysql')">
            {{ showLogs.mysql ? '隐藏日志' : '查看日志' }}
          </ElButton>
        </div>

        <div v-if="showLogs.mysql && installationLogs.mysql.length > 0" class="installation-logs">
          <ElScrollbar height="200px" class="logs-scroll">
            <div class="logs-content">
              <div v-for="(log, index) in installationLogs.mysql" :key="index" :class="getLogClass(log)">
                {{ log }}
              </div>
            </div>
          </ElScrollbar>
        </div>
      </ElCard>
    </div>

    <ElCard title="安装说明" shadow="hover" class="info-card">
      <div class="info-grid">
        <div class="info-item">
          <h4>Docker</h4>
          <ul>
            <li>Docker Engine、CLI、Containerd</li>
            <li>Docker Buildx 和 Compose 插件</li>
            <li>自动配置用户组和开机自启</li>
          </ul>
        </div>
        <div class="info-item">
          <h4>Nginx / Apache</h4>
          <ul>
            <li>安装最新稳定版本</li>
            <li>自动配置防火墙规则</li>
            <li>设置开机自启服务</li>
          </ul>
        </div>
        <div class="info-item">
          <h4>PHP</h4>
          <ul>
            <li>支持多个版本（7.4-8.3）</li>
            <li>包含常用扩展：mysql、curl、gd、mbstring、xml、zip</li>
            <li>安装 PHP-FPM 并配置服务</li>
          </ul>
        </div>
        <div class="info-item">
          <h4>MySQL</h4>
          <ul>
            <li>安装 MySQL Server 最新版本</li>
            <li>默认密码：lpanel@123</li>
            <li>配置远程访问和防火墙规则</li>
          </ul>
        </div>
      </div>
    </ElCard>

    <ElButton type="default" @click="loadServices" style="margin-top: 20px;">刷新状态</ElButton>
  </div>
</template>

<style scoped>
.system-page {
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

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.service-card {
  min-width: 300px;
}

.service-status {
  padding: 10px 0;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.status-row:last-child {
  border-bottom: none;
}

.status-label {
  color: #666;
}

.status-value {
  font-weight: 500;
  color: #333;
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.install-with-select {
  display: flex;
  align-items: center;
  gap: 10px;
}

.info-card {
  margin-top: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.info-item h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.info-item ul {
  margin: 0;
  padding-left: 20px;
}

.info-item li {
  margin: 5px 0;
  color: #666;
  font-size: 14px;
}

.loading-text {
  text-align: center;
  padding: 20px;
  color: #999;
}

.installation-logs {
  margin-top: 15px;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.logs-scroll {
  border-radius: 4px;
}

.logs-content {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.log-error {
  color: #dc3545;
}

.log-success {
  color: #28a745;
}

.log-step {
  color: #007bff;
}

.log-done {
  color: #17a2b8;
}

.log-info {
  color: #6c757d;
}

.log-default {
  color: #333;
}
</style>