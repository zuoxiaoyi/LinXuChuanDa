<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { CalendarRecommendation } from '@/types/domain'

const loading = ref(false)
const generating = ref(false)
const list = ref<CalendarRecommendation[]>([])
const total = ref(0)
const generateVisible = ref(false)
const generateRange = ref<[string, string] | null>(null)
const ruleVersion = ref('2026.1')
const query = reactive({ page: 1, pageSize: 20 })

async function load() {
  loading.value = true
  try {
    const data = await callAdminApi<PageResult<CalendarRecommendation>>(
      'calendarRecommendations.list',
      query
    )
    list.value = data.list
    total.value = data.total
  } catch (error: any) {
    ElMessage.error(error?.message || '日历与颜色加载失败')
  } finally {
    loading.value = false
  }
}

async function generate() {
  if (!generateRange.value) {
    ElMessage.warning('请选择生成日期范围')
    return
  }
  generating.value = true
  try {
    const result = await callAdminApi<{ generated: number; skipped: number }>(
      'calendarRecommendations.generate',
      {
        startDate: generateRange.value[0],
        endDate: generateRange.value[1],
        ruleVersion: ruleVersion.value
      }
    )
    ElMessage.success(`生成${result.generated}天，跳过${result.skipped}天`)
    generateVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="Calendar & colors"
    title="日历与颜色"
    description="先核对农历、干支和五行颜色，再由后续推荐流程叠加城市天气与穿搭。"
  >
    <el-button :icon="Refresh" @click="load">刷新</el-button>
    <el-button type="primary" :icon="MagicStick" @click="generateVisible = true">
      批量生成
    </el-button>
  </PageHeader>

  <section class="surface">
    <div class="table-wrap">
      <el-table v-loading="loading" :data="list">
        <el-table-column prop="date" label="公历" width="120" />
        <el-table-column label="农历" min-width="120">
          <template #default="{ row }">{{ row.calendar.lunarText }}</template>
        </el-table-column>
        <el-table-column label="干支" min-width="190">
          <template #default="{ row }">
            {{ row.calendar.yearGanZhi }}年
            {{ row.calendar.monthGanZhi }}月
            {{ row.calendar.dayGanZhi }}日
          </template>
        </el-table-column>
        <el-table-column label="日支五行" width="100">
          <template #default="{ row }">
            {{ row.calendar.dayBranch }} · {{ row.calendar.dayElement }}
          </template>
        </el-table-column>
        <el-table-column label="首选颜色" min-width="170">
          <template #default="{ row }">
            {{ row.colorAdvice.primary.element }}：{{ row.colorAdvice.primary.colors.join('、') }}
          </template>
        </el-table-column>
        <el-table-column label="次选颜色" min-width="170">
          <template #default="{ row }">
            {{ row.colorAdvice.secondary.element }}：{{ row.colorAdvice.secondary.colors.join('、') }}
          </template>
        </el-table-column>
        <el-table-column label="不建议色" min-width="150">
          <template #default="{ row }">
            {{ row.colorAdvice.avoid.element }}：{{ row.colorAdvice.avoid.colors.join('、') }}
          </template>
        </el-table-column>
        <el-table-column prop="ruleVersion" label="规则版本" width="100" />
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          :page-size="query.pageSize"
          layout="total, prev, pager, next"
          :total="total"
          @current-change="load"
        />
      </div>
    </div>
  </section>

  <el-dialog v-model="generateVisible" title="生成日历与颜色" width="480px">
    <el-form label-position="top">
      <el-form-item label="日期范围">
        <el-date-picker
          v-model="generateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="规则版本">
        <el-input v-model="ruleVersion" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="generateVisible = false">取消</el-button>
      <el-button type="primary" :loading="generating" @click="generate">
        开始生成
      </el-button>
    </template>
  </el-dialog>
</template>
