<script setup lang="ts">
import { useRoute } from 'vue-router'

defineProps<{
  collapsed: boolean
}>()

const route = useRoute()

const menuItems = [
  { path: '/', name: 'dashboard', label: '仪表盘', icon: 'el-icon-s-home' },
  { path: '/monitor', name: 'monitor', label: '服务器监控', icon: 'el-icon-cpu' },
  { path: '/websites', name: 'websites', label: '网站管理', icon: 'el-icon-s-web' },
  { path: '/databases', name: 'databases', label: '数据库管理', icon: 'el-icon-s-data' },
  { path: '/files', name: 'files', label: '文件管理', icon: 'el-icon-folder-opened' },
  { path: '/containers', name: 'containers', label: '容器管理', icon: 'el-icon-box' },
  { path: '/tasks', name: 'tasks', label: '任务计划', icon: 'el-icon-clock' },
  { path: '/system', name: 'system', label: '系统管理', icon: 'el-icon-setting' },
  { path: '/users', name: 'users', label: '用户管理', icon: 'el-icon-user' }
]

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div class="logo">
        <span class="logo-icon">L</span>
        <span v-show="!collapsed" class="logo-text">LPanel</span>
      </div>
    </div>
    <nav class="sidebar-menu">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="menu-item"
        :class="{ active: isActive(item.path) }"
      >
        <i :class="item.icon"></i>
        <span v-show="!collapsed">{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 200px;
  background: #1a1a2e;
  color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #2d2d44;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: #409eff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
}

.logo-text {
  font-size: 18px;
  font-weight: bold;
}

.sidebar-menu {
  flex: 1;
  padding: 10px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  color: #a0aec0;
  text-decoration: none;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.menu-item:hover {
  background: #2d2d44;
  color: #fff;
}

.menu-item.active {
  background: #409eff;
  color: #fff;
}

.menu-item i {
  font-size: 18px;
  width: 24px;
  text-align: center;
}
</style>
