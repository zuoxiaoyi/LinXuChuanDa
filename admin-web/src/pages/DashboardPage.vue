<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Calendar,
  CollectionTag,
  Coin,
  Document,
  User
} from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { DashboardSummary } from '@/types/domain'

const loading = ref(false)
const summary = ref<DashboardSummary>({
  userCount: 0,
  checkinCount: 0,
  collectionCount: 0,
  publishedRecommendationCount: 0,
  draftRecommendationCount: 0,
  pointIssued: 0
})

const cards = [
  { key: 'userCount', label: '累计用户', icon: User },
  { key: 'checkinCount', label: '今日签到', icon: Calendar },
  { key: 'collectionCount', label: '收藏记录', icon: CollectionTag },
  { key: 'pointIssued', label: '累计发放积分', icon: Coin }
] as const

async function load() {
  loading.value = true
  try {
    summary.value = await callAdminApi<DashboardSummary>('dashboard.summary', {
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10)
    })
  } catch (error: any) {
    ElMessage.error(error?.message || '概览加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="Operations overview"
    title="运营概览"
    description="先看内容是否按时发布，再看用户、签到、收藏与积分是否存在异常。"
  >
    <el-button :loading="loading" @click="load">刷新数据</el-button>
  </PageHeader>

  <section v-loading="loading" class="metric-grid">
    <article v-for="(card, index) in cards" :key="card.key" class="metric-card">
      <div class="metric-index">0{{ index + 1 }}</div>
      <el-icon><component :is="card.icon" /></el-icon>
      <strong>{{ summary[card.key].toLocaleString() }}</strong>
      <span>{{ card.label }}</span>
    </article>
  </section>

  <section class="dashboard-grid">
    <article class="surface publish-panel">
      <div class="panel-heading">
        <div>
          <small>CONTENT PIPELINE</small>
          <h2>每日建议发布状态</h2>
        </div>
        <el-icon><Document /></el-icon>
      </div>
      <div class="publish-values">
        <div>
          <strong>{{ summary.publishedRecommendationCount }}</strong>
          <span>已发布</span>
        </div>
        <div>
          <strong>{{ summary.draftRecommendationCount }}</strong>
          <span>待复核草稿</span>
        </div>
      </div>
      <router-link to="/recommendations">进入每日建议管理 →</router-link>
    </article>

    <article class="surface checklist-panel">
      <small>TODAY CHECKLIST</small>
      <h2>上线前检查</h2>
      <ul>
        <li><span>01</span>未来7天建议已生成</li>
        <li><span>02</span>穿搭图片尺寸与状态正常</li>
        <li><span>03</span>天气与广告配置可用</li>
        <li><span>04</span>积分异常记录已复核</li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.metric-card {
  position: relative;
  min-height: 154px;
  overflow: hidden;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 4px 20px 20px 20px;
  background: rgba(255, 253, 248, .9);
}

.metric-card .el-icon {
  color: var(--gold);
  font-size: 25px;
}

.metric-card strong,
.metric-card span {
  display: block;
}

.metric-card strong {
  margin-top: 20px;
  font-family: "IBM Plex Mono", "Cascadia Mono", monospace;
  font-size: 30px;
}

.metric-card span {
  margin-top: 4px;
  color: var(--ink-soft);
  font-size: 12px;
}

.metric-index {
  position: absolute;
  top: 16px;
  right: 18px;
  color: #d7c9b4;
  font-family: "IBM Plex Mono", monospace;
  font-size: 11px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.3fr .7fr;
  gap: 18px;
  margin-top: 20px;
}

.publish-panel,
.checklist-panel {
  padding: 28px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.panel-heading .el-icon {
  color: #d2bea0;
  font-size: 38px;
}

small {
  color: var(--gold);
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  letter-spacing: .14em;
}

h2 {
  margin: 7px 0 0;
  font-family: "Source Han Serif SC", serif;
  font-size: 22px;
}

.publish-values {
  display: flex;
  gap: 60px;
  margin: 34px 0;
}

.publish-values strong,
.publish-values span {
  display: block;
}

.publish-values strong {
  font-family: "IBM Plex Mono", monospace;
  font-size: 34px;
}

.publish-values span {
  color: var(--ink-soft);
  font-size: 12px;
}

.publish-panel a {
  color: var(--gold);
  font-size: 13px;
  text-decoration: none;
}

.checklist-panel ul {
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}

.checklist-panel li {
  display: flex;
  gap: 14px;
  padding: 12px 0;
  color: #5f574c;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}

.checklist-panel li span {
  color: #b09a77;
  font-family: "IBM Plex Mono", monospace;
}
</style>
