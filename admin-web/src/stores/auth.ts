import { defineStore } from 'pinia'
import { callAdminApi } from '@/services/admin-api'
import {
  cloudAuth,
  cloudbaseConfigured,
  demoMode
} from '@/services/cloudbase'
import type { AdminUser } from '@/types/domain'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    admin: null as AdminUser | null,
    initialized: false,
    loading: false
  }),

  getters: {
    isAuthenticated: state => Boolean(state.admin),
    isReady: () => demoMode || cloudbaseConfigured
  },

  actions: {
    async restore() {
      if (this.initialized) return Boolean(this.admin)
      this.loading = true
      try {
        if (demoMode) {
          this.admin = await callAdminApi<AdminUser>('auth.me')
          return true
        }
        if (!cloudAuth) return false
        const { data, error } = await cloudAuth.getSession()
        if (error || !data?.session || data.session.user?.is_anonymous) return false
        this.admin = await callAdminApi<AdminUser>('auth.me')
        return true
      } catch (error) {
        this.admin = null
        return false
      } finally {
        this.initialized = true
        this.loading = false
      }
    },

    async login(username: string, password: string) {
      this.loading = true
      try {
        if (demoMode) {
          this.admin = await callAdminApi<AdminUser>('auth.me')
          this.initialized = true
          return
        }
        if (!cloudAuth) throw new Error('CloudBase尚未配置')
        const { data, error } = await cloudAuth.signInWithPassword({
          username,
          password
        })
        if (error || !data?.session) throw error || new Error('登录失败')
        this.admin = await callAdminApi<AdminUser>('auth.me')
        this.initialized = true
      } finally {
        this.loading = false
      }
    },

    async logout() {
      if (!demoMode && cloudAuth) await cloudAuth.signOut()
      this.admin = null
      this.initialized = true
    }
  }
})
