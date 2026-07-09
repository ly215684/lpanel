
import axios, { InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

function isLoginRequest(url?: string): boolean {
  return url?.includes('/auth/login') || false
}

function isRefreshRequest(url?: string): boolean {
  return url?.includes('/auth/refresh') || false
}

function isLogoutRequest(url?: string): boolean {
  return url?.includes('/auth/logout') || false
}
let errorRequests: { config: InternalAxiosRequestConfig, resolve: (value: any) => void, reject: (reason?: any) => void }[] = []

request.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.accessToken && !isLoginRequest(config.url) && !isRefreshRequest(config.url) && !isLogoutRequest(config.url)) {
      config.headers.Authorization = `Bearer ${authStore.accessToken}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

let isRefreshing = false

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  async (error) => {
    const authStore = useAuthStore()
    const url = error.config?.url

    if (error.response?.status === 401) {
      if (isLoginRequest(url)) {
        authStore.refreshToken = ''
        authStore.logout()
        return Promise.reject(error)
      }

      if (isRefreshRequest(url) || !authStore.refreshToken) {
        authStore.refreshToken = ''
        authStore.logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isLogoutRequest(url)) {
        authStore.refreshToken = ''
        authStore.logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          errorRequests.push({ config: error.config, resolve, reject })
        })
      }
      if (!isRefreshing) {
        isRefreshing = true
        try {
          await authStore.refresh()
          const requests = [...errorRequests]
          errorRequests = []
          requests.forEach(({ config, resolve, reject }) => {
            config.headers.Authorization = `Bearer ${authStore.accessToken}`
            request(config).then(res => {
              resolve(res)
            }).catch(error => reject(error))
          })
          const originalRequest = error.config
          originalRequest.headers.Authorization = `Bearer ${authStore.accessToken}`
          return request(originalRequest)
        } catch (error) {
          authStore.refreshToken = ''
          authStore.logout()
          window.location.href = '/login'
          const requests = [...errorRequests]
          errorRequests = []
          requests.forEach(({ reject }) => {
            reject(error)
          })
          return Promise.reject(error)
        } finally {
          isRefreshing = false
        }
      }
    }

    return Promise.reject(error)
  }
)

export default request
