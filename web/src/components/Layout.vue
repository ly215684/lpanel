<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'

const router = useRouter()
const authStore = useAuthStore()

const collapsed = ref(false)

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="layout-container">
    <Sidebar :collapsed="collapsed" />
    <div class="main-content">
      <Header 
        :collapsed="collapsed" 
        @toggle="collapsed = !collapsed"
        @logout="logout"
      />
      <div class="content-wrapper">
        <router-view />
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-container {
  display: flex;
  height: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

.content-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
