import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, refreshTokenApi, logoutApi, getMeApi } from '@/api'

export interface User {
  id: string
  username: string
  email: string
  role: string
  status: boolean
  created_at: string
  updated_at: string
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'))
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)

  async function login(username: string, password: string) {
    const response = await loginApi(username, password)
    
    accessToken.value = response.access_token
    refreshToken.value = response.refresh_token
    user.value = response.user
    
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('refresh_token', response.refresh_token)
  }

  async function refresh() {
    if (!refreshToken.value) return
    
    const response = await refreshTokenApi(refreshToken.value)
    
    accessToken.value = response.access_token
    refreshToken.value = response.refresh_token
    user.value = response.user
    
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('refresh_token', response.refresh_token)
  }

  async function logout() {
    if (refreshToken.value) {
      await logoutApi(refreshToken.value)
    }
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  async function getMe() {
    if (!accessToken.value) return
    
    const response = await getMeApi()
    user.value = response
  }

  return {
    accessToken,
    refreshToken,
    user,
    isAuthenticated,
    login,
    refresh,
    logout,
    getMe
  }
})
