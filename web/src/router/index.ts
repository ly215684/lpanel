import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/Login.vue')
    },
    {
      path: '/',
      name: 'layout',
      component: () => import('@/components/Layout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/dashboard/Index.vue'),
          meta: { title: '仪表盘' }
        },
        {
          path: '/monitor',
          name: 'monitor',
          component: () => import('@/views/monitor/Index.vue'),
          meta: { title: '服务器监控' }
        },
        {
          path: '/websites',
          name: 'websites',
          component: () => import('@/views/websites/Index.vue'),
          meta: { title: '网站管理' }
        },
        {
          path: '/databases',
          name: 'databases',
          component: () => import('@/views/databases/Index.vue'),
          meta: { title: '数据库管理' }
        },
        {
          path: '/files',
          name: 'files',
          component: () => import('@/views/files/Index.vue'),
          meta: { title: '文件管理' }
        },
        {
          path: '/containers',
          name: 'containers',
          component: () => import('@/views/containers/Index.vue'),
          meta: { title: '容器管理' }
        },
        {
          path: '/tasks',
          name: 'tasks',
          component: () => import('@/views/tasks/Index.vue'),
          meta: { title: '任务计划' }
        },
        {
          path: '/system',
          name: 'system',
          component: () => import('@/views/system/Index.vue'),
          meta: { title: '系统管理' }
        },
        {
          path: '/settings',
          name: 'settings',
          component: () => import('@/views/settings/Index.vue'),
          meta: { title: '设置' }
        }
      ]
    }
  ]
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth) {
    if (!authStore.accessToken) {
      next('/login')
    } else if (!authStore.user) {
      try {
        await authStore.getMe()
        next()
      } catch {
        next('/login')
      }
    } else {
      next()
    }
  } else {
    if (to.path === '/login' && authStore.isAuthenticated) {
      next('/')
    } else {
      next()
    }
  }
})

export default router
