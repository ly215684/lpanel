<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getMonitorAllApi } from '@/api'
import { io, Socket } from 'socket.io-client'
import * as echarts from 'echarts'

interface MonitorData {
  system: { hostname: string; os: string; kernel: string; uptime: number }
  cpu: { model: string; cores: number; usage: number }
  memory: { total: number; used: number; free: number; cached: number; usage: number }
  disk: Array<{ mount: string; total: number; used: number; free: number; usage: number }>
  network: Array<{ interface: string; rx: number; tx: number }>
}

const monitorData = ref<MonitorData | null>(null)
const socket = ref<Socket | null>(null)
const cpuChart = ref<HTMLDivElement | null>(null)
const memoryChart = ref<HTMLDivElement | null>(null)

let cpuChartInstance: echarts.ECharts | null = null
let memoryChartInstance: echarts.ECharts | null = null

const cpuHistory = ref<number[]>([])
const memoryHistory = ref<number[]>([])
const timeLabels = ref<string[]>([])

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function initCharts() {
  if (cpuChart.value) {
    cpuChartInstance = echarts.init(cpuChart.value)
    updateCpuChart()
  }
  if (memoryChart.value) {
    memoryChartInstance = echarts.init(memoryChart.value)
    updateMemoryChart()
  }
}

function updateCharts() {
  updateCpuChart()
  updateMemoryChart()
}

function updateCpuChart() {
  if (!cpuChartInstance) return
  
  const now = new Date()
  timeLabels.value.push(formatTime(now.getMinutes() * 60 + now.getSeconds()))
  cpuHistory.value.push(monitorData.value?.cpu.usage || 0)
  
  if (timeLabels.value.length > 30) {
    timeLabels.value.shift()
    cpuHistory.value.shift()
  }
  
  cpuChartInstance.setOption({
    title: { text: 'CPU 使用率', left: 'center', textStyle: { fontSize: 14 } },
    xAxis: { type: 'category', data: timeLabels.value, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', min: 0, max: 100 },
    tooltip: { formatter: '{c}%' },
    series: [{
      type: 'line',
      data: cpuHistory.value,
      smooth: true,
      areaStyle: { opacity: 0.3 },
      lineStyle: { color: '#409eff' }
    }]
  })
}

function updateMemoryChart() {
  if (!memoryChartInstance) return
  
  memoryHistory.value.push(monitorData.value?.memory.usage || 0)
  
  if (memoryHistory.value.length > 30) {
    memoryHistory.value.shift()
  }
  
  memoryChartInstance.setOption({
    title: { text: '内存使用率', left: 'center', textStyle: { fontSize: 14 } },
    xAxis: { type: 'category', data: timeLabels.value, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', min: 0, max: 100 },
    tooltip: { formatter: '{c}%' },
    series: [{
      type: 'line',
      data: memoryHistory.value,
      smooth: true,
      areaStyle: { opacity: 0.3 },
      lineStyle: { color: '#67c23a' }
    }]
  })
}

async function fetchData() {
  try {
    monitorData.value = await getMonitorAllApi()
    updateCharts()
  } catch {
    console.error('Failed to fetch monitor data')
  }
}

onMounted(() => {
  fetchData()
  initCharts()
  
  socket.value = io()
  socket.value.on('monitor:update', (data: MonitorData) => {
    monitorData.value = data
    updateCharts()
  })
  
  window.addEventListener('resize', () => {
    cpuChartInstance?.resize()
    memoryChartInstance?.resize()
  })
})

onUnmounted(() => {
  socket.value?.disconnect()
  cpuChartInstance?.dispose()
  memoryChartInstance?.dispose()
})
</script>

<template>
  <div class="monitor-page">
    <div class="charts-grid">
      <div class="chart-card">
        <div ref="cpuChart" class="chart"></div>
      </div>
      <div class="chart-card">
        <div ref="memoryChart" class="chart"></div>
      </div>
    </div>
    
    <div class="detail-grid">
      <div class="detail-card">
        <h3>系统状态</h3>
        <div class="detail-list">
          <div class="detail-item">
            <span class="detail-label">主机名</span>
            <span class="detail-value">{{ monitorData?.system.hostname }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">操作系统</span>
            <span class="detail-value">{{ monitorData?.system.os }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">内核版本</span>
            <span class="detail-value">{{ monitorData?.system.kernel }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">CPU 型号</span>
            <span class="detail-value">{{ monitorData?.cpu.model }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">CPU 核心</span>
            <span class="detail-value">{{ monitorData?.cpu.cores }} 核</span>
          </div>
        </div>
      </div>
      
      <div class="detail-card">
        <h3>内存详情</h3>
        <div class="memory-detail">
          <div class="memory-item">
            <span class="memory-label">总内存</span>
            <span class="memory-value">{{ formatBytes(monitorData?.memory.total || 0) }}</span>
          </div>
          <div class="memory-item">
            <span class="memory-label">已使用</span>
            <span class="memory-value" style="color: #e74c3c">{{ formatBytes(monitorData?.memory.used || 0) }}</span>
          </div>
          <div class="memory-item">
            <span class="memory-label">空闲</span>
            <span class="memory-value" style="color: #67c23a">{{ formatBytes(monitorData?.memory.free || 0) }}</span>
          </div>
          <div class="memory-item">
            <span class="memory-label">缓存</span>
            <span class="memory-value" style="color: #409eff">{{ formatBytes(monitorData?.memory.cached || 0) }}</span>
          </div>
        </div>
        <div class="memory-progress">
          <div class="memory-bar used" :style="{ width: (monitorData?.memory.used || 0) / (monitorData?.memory.total || 1) * 100 + '%' }"></div>
          <div class="memory-bar cached" :style="{ width: (monitorData?.memory.cached || 0) / (monitorData?.memory.total || 1) * 100 + '%' }"></div>
        </div>
      </div>
      
      <div class="detail-card">
        <h3>磁盘详情</h3>
        <div class="disk-detail">
          <div v-for="disk in monitorData?.disk" :key="disk.mount" class="disk-info">
            <div class="disk-header">
              <span>{{ disk.mount }}</span>
              <span>{{ disk.usage }}%</span>
            </div>
            <div class="disk-bar-container">
              <div class="disk-bar" :style="{ width: disk.usage + '%' }"></div>
            </div>
            <div class="disk-size">{{ formatBytes(disk.used) }} / {{ formatBytes(disk.total) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.monitor-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.chart {
  height: 300px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.detail-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.detail-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-label {
  color: #999;
  font-size: 14px;
}

.detail-value {
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

.memory-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.memory-item {
  display: flex;
  justify-content: space-between;
}

.memory-label {
  color: #999;
  font-size: 14px;
}

.memory-value {
  font-weight: 500;
  font-size: 14px;
}

.memory-progress {
  height: 24px;
  background: #f0f0f0;
  border-radius: 12px;
  display: flex;
  overflow: hidden;
}

.memory-bar {
  height: 100%;
  transition: width 0.3s;
}

.memory-bar.used {
  background: #e74c3c;
}

.memory-bar.cached {
  background: #409eff;
}

.disk-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.disk-info {
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.disk-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.disk-header span:first-child {
  font-weight: 500;
}

.disk-header span:last-child {
  font-weight: bold;
  color: #409eff;
}

.disk-bar-container {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.disk-bar {
  height: 100%;
  background: #409eff;
  border-radius: 4px;
  transition: width 0.3s;
}

.disk-size {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}
</style>
