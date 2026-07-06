<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getMonitorAllApi } from '@/api'
import { io, Socket } from 'socket.io-client'

interface MonitorData {
  system: { hostname: string; os: string; kernel: string; uptime: number }
  cpu: { model: string; cores: number; usage: number }
  memory: { total: number; used: number; free: number; cached: number; usage: number }
  disk: Array<{ mount: string; total: number; used: number; free: number; usage: number }>
  network: Array<{ interface: string; rx: number; tx: number }>
}

const monitorData = ref<MonitorData | null>(null)
const socket = ref<Socket | null>(null)

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${days}天 ${hours}小时 ${minutes}分钟 ${secs}秒`
}

async function fetchData() {
  try {
    monitorData.value = await getMonitorAllApi()
  } catch {
    console.error('Failed to fetch monitor data')
  }
}

onMounted(() => {
  fetchData()
  
  socket.value = io()
  socket.value.on('monitor:update', (data: MonitorData) => {
    monitorData.value = data
  })
})

onUnmounted(() => {
  socket.value?.disconnect()
})
</script>

<template>
  <div class="dashboard">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon cpu-icon">
          <i class="el-icon-cpu"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value" :style="{ color: (monitorData?.cpu?.usage ?? 0) > 80 ? '#e74c3c' : '#409eff' }">
            {{ monitorData?.cpu?.usage ?? 0 }}%
          </div>
          <div class="stat-label">CPU 使用率</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon memory-icon">
          <i class="el-icon-s-data"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value" :style="{ color: (monitorData?.memory?.usage ?? 0) > 80 ? '#e74c3c' : '#67c23a' }">
            {{ formatBytes(monitorData?.memory?.used ?? 0) }} / {{ formatBytes(monitorData?.memory?.total ?? 0) }}
          </div>
          <div class="stat-label">内存使用</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon disk-icon">
          <i class="el-icon-hard-drive"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value" :style="{ color: (monitorData?.disk[0]?.usage || 0) > 80 ? '#e74c3c' : '#f56c6c' }">
            {{ monitorData?.disk[0]?.usage || 0 }}%
          </div>
          <div class="stat-label">磁盘使用率</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon uptime-icon">
          <i class="el-icon-clock"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ formatUptime(monitorData?.system.uptime || 0) }}</div>
          <div class="stat-label">系统运行时间</div>
        </div>
      </div>
    </div>
    
    <div class="info-grid">
      <div class="info-card">
        <h3>系统信息</h3>
        <div class="info-list">
          <div class="info-item">
            <span class="info-label">主机名</span>
            <span class="info-value">{{ monitorData?.system.hostname }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">操作系统</span>
            <span class="info-value">{{ monitorData?.system.os }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">内核版本</span>
            <span class="info-value">{{ monitorData?.system.kernel }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">CPU 型号</span>
            <span class="info-value">{{ monitorData?.cpu.model }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">CPU 核心数</span>
            <span class="info-value">{{ monitorData?.cpu.cores }} 核</span>
          </div>
        </div>
      </div>
      
      <div class="info-card">
        <h3>磁盘信息</h3>
        <div class="disk-list">
          <div v-for="disk in monitorData?.disk" :key="disk.mount" class="disk-item">
            <div class="disk-header">
              <span class="disk-name">{{ disk.mount }}</span>
              <span class="disk-usage">{{ disk.usage }}%</span>
            </div>
            <div class="disk-progress">
              <div class="disk-bar" :style="{ width: disk.usage + '%', background: disk.usage > 80 ? '#e74c3c' : '#409eff' }"></div>
            </div>
            <div class="disk-detail">
              {{ formatBytes(disk.used) }} / {{ formatBytes(disk.total) }}
            </div>
          </div>
        </div>
      </div>
      
      <div class="info-card">
        <h3>网络接口</h3>
        <div class="network-list">
          <div v-for="net in monitorData?.network" :key="net.interface" class="network-item">
            <div class="network-name">{{ net.interface }}</div>
            <div class="network-rx">RX: {{ formatBytes(net.rx) }}</div>
            <div class="network-tx">TX: {{ formatBytes(net.tx) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
}

.cpu-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.memory-icon {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.disk-icon {
  background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
}

.uptime-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.info-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.info-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-label {
  color: #999;
  font-size: 14px;
}

.info-value {
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

.disk-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.disk-item {
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.disk-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.disk-name {
  font-weight: 500;
  color: #333;
}

.disk-usage {
  font-weight: bold;
  color: #409eff;
}

.disk-progress {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.disk-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.disk-detail {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.network-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.network-item {
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.network-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.network-ip {
  font-size: 14px;
  color: #409eff;
  margin-bottom: 2px;
}

.network-mac {
  font-size: 12px;
  color: #999;
}
</style>
