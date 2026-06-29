<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Calendar,
  Collection,
  DataAnalysis,
  Goods,
  Setting,
  User,
  Van
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const menuItems = [
  { path: '/', label: '运营概览', icon: DataAnalysis },
  { path: '/outfits', label: '穿搭素材', icon: Goods },
  { path: '/accessories', label: '幸运配饰', icon: Van },
  { path: '/recommendations', label: '每日建议', icon: Calendar },
  { path: '/content', label: '内容配置', icon: Collection },
  { path: '/users', label: '用户与积分', icon: User },
  { path: '/settings', label: '系统配置', icon: Setting }
]

const activePath = computed(() => route.path)

async function logout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">灵</span>
        <div>
          <strong>灵序穿搭</strong>
          <small>运营控制台</small>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          :class="{ active: activePath === item.path }"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <span class="status-dot" />
        <div>
          <strong>{{ auth.admin?.displayName }}</strong>
          <small>{{ auth.admin?.role }}</small>
        </div>
        <el-button text class="logout-button" @click="logout">退出</el-button>
      </div>
    </aside>

    <main class="main-panel">
      <div class="top-ribbon">
        <span>LINXU / OPERATIONS</span>
        <span>{{ new Date().toLocaleDateString('zh-CN') }}</span>
      </div>
      <div class="page-container">
        <router-view />
      </div>
    </main>
  </div>
</template>
