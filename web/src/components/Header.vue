<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

defineProps<{
  collapsed: boolean
}>()

defineEmits<{
  toggle: []
  logout: []
}>()

const authStore = useAuthStore()
</script>

<template>
  <header class="header">
    <div class="header-left">
      <button class="toggle-btn" @click="$emit('toggle')">
        <i class="el-icon-s-fold"></i>
      </button>
      <span class="title">{{ $route.meta.title || 'LPanel' }}</span>
    </div>
    <div class="header-right">
      <div class="user-info">
        <span class="user-name">{{ authStore.user?.username }}</span>
        <span class="user-role">{{ authStore.user?.role === 'admin' ? '管理员' : '用户' }}</span>
      </div>
      <button class="logout-btn" @click="$emit('logout')">
        <i class="el-icon-switch-button"></i>
        <span>退出登录</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toggle-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f5f5f5;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.toggle-btn:hover {
  background: #e0e0e0;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-name {
  font-weight: 600;
  color: #333;
}

.user-role {
  padding: 4px 10px;
  background: #f0f9ff;
  color: #409eff;
  border-radius: 12px;
  font-size: 12px;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #f5f5f5;
  color: #e74c3c;
  border-color: #e74c3c;
}
</style>
