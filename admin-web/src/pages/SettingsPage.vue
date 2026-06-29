<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'

const loading = ref(false)
const saving = ref(false)
const form = reactive({
  checkin: {
    basePoints: 1,
    multipliers: [
      { multiplier: 2, weight: 50 },
      { multiplier: 3, weight: 30 },
      { multiplier: 4, weight: 15 },
      { multiplier: 5, weight: 5 }
    ]
  },
  unlock: {
    freeDays: 3,
    adUnlockDays: 4,
    costPoints: 5
  }
})

async function load() {
  loading.value = true
  try {
    const data = await callAdminApi<any>('configs.get')
    if (data?.checkin) Object.assign(form.checkin, data.checkin)
    if (data?.unlock) Object.assign(form.unlock, data.unlock)
  } catch (error: any) {
    ElMessage.error(error?.message || '配置加载失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  const totalWeight = form.checkin.multipliers
    .reduce((sum, item) => sum + Number(item.weight), 0)
  if (totalWeight !== 100) {
    ElMessage.warning('签到倍率概率之和必须等于100%')
    return
  }
  saving.value = true
  try {
    await callAdminApi('configs.save', JSON.parse(JSON.stringify(form)))
    ElMessage.success('运营配置已保存')
  } catch (error: any) {
    ElMessage.error(error?.message || '配置保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="Operation settings"
    title="系统配置"
    description="只开放低风险运营参数；密钥、任意脚本和数据库权限不在Web后台维护。"
  >
    <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
  </PageHeader>

  <div v-loading="loading" class="settings-grid">
    <section class="surface settings-panel">
      <p class="panel-index">01 / CHECK-IN</p>
      <h2>签到与翻倍</h2>
      <el-form label-position="top">
        <el-form-item label="基础签到积分">
          <el-input-number v-model="form.checkin.basePoints" :min="1" :max="100" />
        </el-form-item>
        <div class="multiplier-row" v-for="item in form.checkin.multipliers" :key="item.multiplier">
          <span>{{ item.multiplier }}倍</span>
          <el-input-number v-model="item.weight" :min="0" :max="100" />
          <small>%</small>
        </div>
      </el-form>
    </section>

    <section class="surface settings-panel">
      <p class="panel-index">02 / UNLOCK</p>
      <h2>内容解锁</h2>
      <el-form label-position="top">
        <el-form-item label="免费展示天数">
          <el-input-number v-model="form.unlock.freeDays" :min="1" :max="7" />
        </el-form-item>
        <el-form-item label="一次广告解锁天数">
          <el-input-number v-model="form.unlock.adUnlockDays" :min="1" :max="14" />
        </el-form-item>
        <el-form-item label="积分解锁价格">
          <el-input-number v-model="form.unlock.costPoints" :min="1" :max="999" />
        </el-form-item>
      </el-form>
    </section>

    <section class="surface settings-panel secure-panel">
      <p class="panel-index">03 / SECRETS</p>
      <h2>服务端密钥</h2>
      <p>
        天气服务密钥、管理员API Key、广告服务凭证必须在CloudBase服务端环境变量中配置，
        不允许通过当前页面读取或写入。
      </p>
    </section>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.settings-panel {
  padding: 26px;
}

.panel-index {
  margin: 0;
  color: var(--gold);
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  letter-spacing: .14em;
}

.settings-panel h2 {
  margin: 8px 0 24px;
  font-family: "Source Han Serif SC", serif;
}

.multiplier-row {
  display: grid;
  grid-template-columns: 1fr 140px 24px;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}

.multiplier-row small {
  color: #918574;
}

.secure-panel {
  grid-column: 1 / -1;
  color: #6f6557;
  background: #ece3d3;
}

.secure-panel p:last-child {
  max-width: 760px;
  line-height: 1.8;
}
</style>
