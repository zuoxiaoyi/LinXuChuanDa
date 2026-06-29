<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { DailyRecommendation } from '@/types/domain'

const loading = ref(false)
const generating = ref(false)
const list = ref<DailyRecommendation[]>([])
const total = ref(0)
const generateVisible = ref(false)
const generateRange = ref<[string, string] | null>(null)
const ruleVersion = ref('2026.1')
const query = reactive({ page: 1, pageSize: 20, status: '' })

async function load() {
  loading.value = true
  try {
    const data = await callAdminApi<PageResult<DailyRecommendation>>(
      'recommendations.list',
      query
    )
    list.value = data.list
    total.value = data.total
  } catch (error: any) {
    ElMessage.error(error?.message || '每日建议加载失败')
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
      'recommendations.generate',
      {
        startDate: generateRange.value[0],
        endDate: generateRange.value[1],
        ruleVersion: ruleVersion.value,
        overwriteDraft: false
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

async function publish(row: DailyRecommendation | any) {
  await ElMessageBox.confirm(
    `发布${row.date}的每日建议后，小程序将读取这份快照。`,
    '发布确认'
  )
  try {
    await callAdminApi('recommendations.publish', {
      id: row._id,
      version: row.version
    })
    ElMessage.success('已发布')
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '发布失败')
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="Daily recommendation"
    title="每日建议"
    description="算法只生成草稿；运营人员查看匹配分数和原因，确认后再发布给小程序。"
  >
    <el-button :icon="Refresh" @click="load">刷新</el-button>
    <el-button type="primary" :icon="MagicStick" @click="generateVisible = true">
      批量生成
    </el-button>
  </PageHeader>

  <section class="surface">
    <div class="toolbar">
      <el-select v-model="query.status" clearable placeholder="全部状态" style="width: 150px" @change="load">
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="已停用" value="disabled" />
      </el-select>
      <div class="toolbar-spacer" />
      <span class="hint">同一日期只允许一条正式发布快照</span>
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="list">
        <el-table-column prop="date" label="日期" width="130" />
        <el-table-column prop="ruleVersion" label="规则版本" width="110" />
        <el-table-column label="最佳/次佳" min-width="150">
          <template #default="{ row }">
            {{ row.bestOutfits.length }} / {{ row.secondaryOutfits.length }}
          </template>
        </el-table-column>
        <el-table-column label="配饰" width="90">
          <template #default="{ row }">{{ row.accessoryIds.length }}</template>
        </el-table-column>
        <el-table-column label="生成方式" width="110">
          <template #default="{ row }">
            <el-tag effect="plain">{{ row.generationMode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="人工调整" width="100">
          <template #default="{ row }">{{ row.manualOverride ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary">查看/调整</el-button>
            <el-button v-if="row.status !== 'published'" link type="success" @click="publish(row)">
              发布
            </el-button>
          </template>
        </el-table-column>
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

  <el-dialog v-model="generateVisible" title="批量生成每日建议" width="480px">
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
      <el-alert
        title="生成结果只保存为草稿，不会自动发布。"
        type="warning"
        :closable="false"
      />
    </el-form>
    <template #footer>
      <el-button @click="generateVisible = false">取消</el-button>
      <el-button type="primary" :loading="generating" @click="generate">开始生成</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  color: #8b806f;
  font-size: 12px;
}
</style>
