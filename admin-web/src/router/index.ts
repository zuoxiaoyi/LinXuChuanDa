import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      component: () => import('@/layout/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue')
        },
        {
          path: 'outfits',
          name: 'outfits',
          component: () => import('@/pages/OutfitsPage.vue')
        },
        {
          path: 'accessories',
          name: 'accessories',
          component: () => import('@/pages/AccessoriesPage.vue')
        },
        {
          path: 'recommendations',
          name: 'recommendations',
          component: () => import('@/pages/RecommendationsPage.vue')
        },
        {
          path: 'content',
          name: 'content',
          component: () => import('@/pages/ContentPage.vue')
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/pages/UsersPage.vue')
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/pages/SettingsPage.vue')
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/pages/NotFoundPage.vue')
    }
  ]
})

router.beforeEach(async to => {
  const auth = useAuthStore()
  const authenticated = await auth.restore()

  if (to.meta.public) {
    if (to.name === 'login' && authenticated) return { name: 'dashboard' }
    return true
  }
  if (!authenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    }
  }
  return true
})

export default router
