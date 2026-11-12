<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { MagicStick, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { Accessory, DailyRecommendation, Outfit } from '@/types/domain'

interface MaterialOption {
  label: string
  value: string
}

interface PublishDetail {
  id?: string
  date?: string
  ok: boolean
  reason: string
}

const loading = ref(false)
const generating = ref(false)
const publishing = ref(false)
const detailSaving = ref(false)
const autoFilling = ref(false)
const list = ref<DailyRecommendation[]>([])
const total = ref(0)
const generateVisible = ref(false)
const generateFormRef = ref<FormInstance>()
const generateForm = reactive<{
  range: [string, string] | null
  ruleVersion: string
  overwriteDraft: boolean
}>({
  range: null,
  ruleVersion: '2026.1',
  overwriteDraft: false
})
const generateRules: FormRules<typeof generateForm> = {
  range: [{ required: true, message: '请选择生成日期范围', trigger: 'change' }],
  ruleVersion: [{ required: true, message: '请填写规则版本', trigger: 'blur' }]
}
const query = reactive<{
  page: number
  pageSize: number
  status: string
  range: [string, string] | null
}>({
  page: 1,
  pageSize: 20,
  status: '',
  range: null
})

const generationModeLabels: Record<string, string> = {
  algorithm: '算法生成',
  manual: '人工编排',
  mixed: '混合调整'
}
const statusLabels: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已停用'
}

function formatDateTime(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { hour12: false })
}

// Element Plus 表格插槽里的 row 默认类型为 DefaultRow，这里显式放宽
function isPublishable(row: DailyRecommendation | any) {
  return (row.bestOutfits?.length || 0) >= 3
    && (row.secondaryOutfits?.length || 0) >= 3
    && (row.accessoryIds?.length || 0) >= 1
}

// 改动筛选条件时回到第一页，否则停在旧页码会看到空列表
function onFilterChange() {
  query.page = 1
  load()
}

async function load() {
  loading.value = true
  try {
    const data = await callAdminApi<PageResult<DailyRecommendation>>(
      'recommendations.list',
      {
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        startDate: query.range?.[0] || '',
        endDate: query.range?.[1] || ''
      }
    )
    list.value = data.list
    total.value = data.total
  } catch (error: any) {
    ElMessage.error(error?.message || '穿搭详情数据加载失败')
  } finally {
    loading.value = false
  }
}

async function generate() {
  const formRef = generateFormRef.value
  if (!formRef) return
  try {
    await formRef.validate()
  } catch {
    return
  }
  generating.value = true
  try {
    const result = await callAdminApi<{
      generated: number
      updated?: number
      skipped: number
      unfilled?: number
    }>('recommendations.generate', {
      startDate: generateForm.range![0],
      endDate: generateForm.range![1],
      ruleVersion: generateForm.ruleVersion,
      overwriteDraft: generateForm.overwriteDraft
    })
    const summary = `新增${result.generated}天、回填${result.updated || 0}天、跳过${result.skipped}天`
    if (result.unfilled) {
      ElMessage.warning(
        `${summary}；其中${result.unfilled}天素材不足，需先补充已发布的穿搭与配饰`
      )
    } else {
      ElMessage.success(summary)
    }
    generateVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

async function publish(row: DailyRecommendation | any) {
  try {
    await ElMessageBox.confirm(
      `发布 ${row.date} 的穿搭配置后，小程序穿搭详情页将读取这份快照。`,
      '发布确认',
      { center: true }
    )
  } catch {
    return
  }
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

// ===================== 批量发布 =====================
const selection = ref<DailyRecommendation[]>([])
const resultVisible = ref(false)
const publishResult = ref<{ published: number; skipped: number; details: PublishDetail[] }>({
  published: 0,
  skipped: 0,
  details: []
})

function onSelectionChange(rows: DailyRecommendation[]) {
  selection.value = rows
}

async function batchPublish() {
  const ids = selection.value.map(row => row._id).filter((id): id is string => !!id)
  if (!ids.length) {
    ElMessage.warning('请先勾选要发布的日期')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将发布选中的 ${ids.length} 天穿搭配置。已发布或内容不完整的记录会自动跳过，不影响其它日期。`,
      '批量发布确认',
      { center: true }
    )
  } catch {
    return
  }
  publishing.value = true
  try {
    const result = await callAdminApi<{
      published: number
      skipped: number
      details: PublishDetail[]
    }>('recommendations.batchPublish', { ids })
    publishResult.value = result
    resultVisible.value = true
    if (result.published) ElMessage.success(`成功发布 ${result.published} 天`)
    else ElMessage.warning('没有可发布的记录，请查看明细')
    selection.value = []
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '批量发布失败')
  } finally {
    publishing.value = false
  }
}

// ===================== 查看 / 调整 =====================
const detailVisible = ref(false)
const detailRow = ref<DailyRecommendation | null>(null)
const outfitOptions = ref<MaterialOption[]>([])
const accessoryOptions = ref<MaterialOption[]>([])
const detailForm = reactive({
  bestOutfitIds: [] as string[],
  secondaryOutfitIds: [] as string[],
  accessoryIds: [] as string[]
})

async function loadMaterialOptions() {
  try {
    const [outfits, accessories] = await Promise.all([
      callAdminApi<PageResult<Outfit>>('outfits.list', {
        page: 1, pageSize: 100, status: 'published'
      }),
      callAdminApi<PageResult<Accessory>>('accessories.list', {
        page: 1, pageSize: 100, status: 'published'
      })
    ])
    outfitOptions.value = outfits.list
      .filter(item => !!item._id)
      .map(item => ({ label: item.title || item._id!, value: item._id! }))
    accessoryOptions.value = accessories.list
      .filter(item => !!item._id)
      .map(item => ({ label: item.name || item._id!, value: item._id! }))
  } catch (error: any) {
    ElMessage.warning(error?.message || '素材选项加载失败，可稍后重试')
  }
}

async function openDetail(row: DailyRecommendation | any) {
  detailRow.value = row
  detailForm.bestOutfitIds = (row.bestOutfits || []).map(
    (item: { outfitId: string }) => item.outfitId
  )
  detailForm.secondaryOutfitIds = (row.secondaryOutfits || []).map(
    (item: { outfitId: string }) => item.outfitId
  )
  detailForm.accessoryIds = [...(row.accessoryIds || [])]
  detailVisible.value = true
  if (!outfitOptions.value.length) await loadMaterialOptions()
}

function colorsOf(level?: { element?: string; colors?: string[] }) {
  return (level?.colors || []).join('、') || '—'
}

async function autoFillDetail() {
  if (!detailRow.value) return
  autoFilling.value = true
  try {
    const fill = await callAdminApi<{
      bestOutfits: Array<{ outfitId: string }>
      secondaryOutfits: Array<{ outfitId: string }>
      accessoryIds: string[]
    }>('recommendations.autoFill', { date: detailRow.value.date })
    detailForm.bestOutfitIds = fill.bestOutfits.map(item => item.outfitId)
    detailForm.secondaryOutfitIds = fill.secondaryOutfits.map(item => item.outfitId)
    detailForm.accessoryIds = [...fill.accessoryIds]
    ElMessage.success('已按当日宜穿色挑选，确认后点保存')
  } catch (error: any) {
    ElMessage.error(error?.message || '自动挑选失败')
  } finally {
    autoFilling.value = false
  }
}

async function saveDetail(publishAfter = false) {
  const row = detailRow.value
  if (!row?._id) return
  const toEntries = (ids: string[]) =>
    ids.map(outfitId => ({ outfitId, scene: '人工调整', score: 0 }))
  detailSaving.value = true
  try {
    const saved = await callAdminApi<{ version: number }>('recommendations.save', {
      ...row,
      bestOutfits: toEntries(detailForm.bestOutfitIds),
      secondaryOutfits: toEntries(detailForm.secondaryOutfitIds),
      accessoryIds: [...detailForm.accessoryIds],
      generationMode: 'mixed',
      manualOverride: true,
      status: 'draft'
    })
    if (publishAfter) {
      await callAdminApi('recommendations.publish', { id: row._id, version: saved.version })
    }
    ElMessage.success(publishAfter ? '已保存并发布' : '草稿已保存')
    detailVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    detailSaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="详情页配置"
    title="穿搭详情"
    description="按日期配置小程序穿搭详情页展示的 6 套穿搭与幸运配饰；算法先生成草稿，运营核对后单条或批量发布。"
  >
    <el-button :icon="Refresh" @click="load">刷新</el-button>
    <el-button
      type="success"
      :loading="publishing"
      :disabled="!selection.length"
      @click="batchPublish"
    >
      批量发布<span v-if="selection.length">（{{ selection.length }}）</span>
    </el-button>
    <el-button type="primary" :icon="MagicStick" @click="generateVisible = true">
      批量生成
    </el-button>
  </PageHeader>

  <section class="surface">
    <div class="toolbar">
      <el-date-picker
        v-model="query.range"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        clearable
        style="width: 268px"
        @change="onFilterChange"
      />
      <el-select v-model="query.status" clearable placeholder="全部状态" style="width: 150px" @change="onFilterChange">
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="已停用" value="disabled" />
      </el-select>
      <div class="toolbar-spacer" />
      <span class="hint">同一日期只允许一条正式发布快照</span>
    </div>

    <el-alert
      class="scope-alert"
      type="info"
      :closable="false"
      show-icon
      title="发布后控制哪些页面"
      description="本页按日期配置小程序「穿搭详情」页展示的最佳 / 次佳 6 套穿搭与幸运配饰；宜穿色与干支来自「日历与颜色」，「我的」页简介来自「内容配置」，都不在这里维护。发布需满足 3 套最佳 + 3 套次佳 + 至少 1 个配饰（建议 3 个，不足时小程序自动补齐）。"
    />

    <div class="table-wrap">
      <el-table v-loading="loading" :data="list" width="100%" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="46" />
        <el-table-column prop="date" label="日期" min-width="120" />
        <el-table-column prop="ruleVersion" label="规则版本" min-width="100" />
        <el-table-column label="最佳/次佳" min-width="130">
          <template #default="{ row }">
            <span :class="{ insufficient: !isPublishable(row) }">
              {{ row.bestOutfits?.length || 0 }} / {{ row.secondaryOutfits?.length || 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="配饰" min-width="80">
          <template #default="{ row }">{{ row.accessoryIds?.length || 0 }}</template>
        </el-table-column>
        <el-table-column label="生成方式" min-width="110">
          <template #default="{ row }">
            <el-tag effect="plain">{{ generationModeLabels[row.generationMode] || row.generationMode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="人工调整" min-width="100">
          <template #default="{ row }">{{ row.manualOverride ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="状态" min-width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : row.status === 'disabled' ? 'danger' : 'info'">
              {{ statusLabels[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看/调整</el-button>
            <el-button v-if="row.status !== 'published'" link type="success" @click="publish(row)">
              发布
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          :total="total"
          @current-change="load"
          @size-change="onFilterChange"
        />
      </div>
    </div>
  </section>

  <!-- 批量生成 -->
  <el-dialog v-model="generateVisible" title="批量生成穿搭详情" width="480px">
    <el-form ref="generateFormRef" :model="generateForm" :rules="generateRules" label-position="top">
      <el-form-item label="日期范围" prop="range">
        <el-date-picker
          v-model="generateForm.range"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="规则版本" prop="ruleVersion">
        <el-input v-model="generateForm.ruleVersion" />
      </el-form-item>
      <el-checkbox v-model="generateForm.overwriteDraft" class="overwrite-option">
        回填已有草稿（把早期生成的空记录补齐，已发布或人工调整过的不动）
      </el-checkbox>
      <el-alert
        title="按当日宜穿色自动挑选 3 套最佳、3 套次佳与 3 个配饰，结果只保存为草稿，不会自动发布。"
        type="warning"
        :closable="false"
      />
    </el-form>
    <template #footer>
      <el-button @click="generateVisible = false">取消</el-button>
      <el-button type="primary" :loading="generating" @click="generate">开始生成</el-button>
    </template>
  </el-dialog>

  <!-- 批量发布结果 -->
  <el-dialog v-model="resultVisible" title="批量发布结果" width="600px">
    <el-alert
      class="result-alert"
      :type="publishResult.published ? 'success' : 'warning'"
      :closable="false"
      show-icon
      :title="`成功发布 ${publishResult.published} 天，跳过 ${publishResult.skipped} 天`"
      description="跳过的记录通常是已发布，或最佳 / 次佳 / 配饰数量不足；可在「查看/调整」里补齐后重新发布。"
    />
    <el-table :data="publishResult.details" max-height="320" size="small">
      <el-table-column prop="date" label="日期" width="130" />
      <el-table-column label="结果" width="90">
        <template #default="{ row }">
          <el-tag :type="row.ok ? 'success' : 'info'" effect="plain">
            {{ row.ok ? '成功' : '跳过' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="说明" min-width="180" />
    </el-table>
    <template #footer>
      <el-button type="primary" @click="resultVisible = false">知道了</el-button>
    </template>
  </el-dialog>

  <!-- 查看 / 调整 -->
  <el-drawer v-model="detailVisible" :title="`${detailRow?.date || ''} 穿搭详情`" size="620px">
    <template v-if="detailRow">
      <el-descriptions :column="2" border size="small" class="detail-desc">
        <el-descriptions-item label="规则版本">{{ detailRow.ruleVersion }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabels[detailRow.status] || detailRow.status }}</el-descriptions-item>
        <el-descriptions-item label="生成方式">
          {{ generationModeLabels[detailRow.generationMode] || detailRow.generationMode }}
        </el-descriptions-item>
        <el-descriptions-item label="人工调整">{{ detailRow.manualOverride ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detailRow.createdAt) || '—' }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDateTime(detailRow.updatedAt) || '—' }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        class="detail-alert"
        type="info"
        :closable="false"
        :title="`首选色：${colorsOf(detailRow.colorAdvice?.primary)}　次选色：${colorsOf(detailRow.colorAdvice?.secondary)}`"
        :description="`不建议色：${colorsOf(detailRow.colorAdvice?.avoid)}；发布要求：3 套最佳 + 3 套次佳 + 至少 1 个幸运配饰（建议选满 3 个，对应详情页三列）。`"
      />

      <el-form label-position="top" class="detail-form">
        <el-form-item label="最佳穿搭（建议 3 套）">
          <el-select v-model="detailForm.bestOutfitIds" multiple filterable collapse-tags style="width: 100%">
            <el-option v-for="opt in outfitOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="次佳穿搭（建议 3 套）">
          <el-select v-model="detailForm.secondaryOutfitIds" multiple filterable collapse-tags style="width: 100%">
            <el-option v-for="opt in outfitOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="幸运配饰（建议 3 个，对应详情页三列）">
          <el-select
            v-model="detailForm.accessoryIds"
            multiple
            filterable
            collapse-tags
            :multiple-limit="3"
            style="width: 100%"
          >
            <el-option v-for="opt in accessoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-button :loading="autoFilling" @click="autoFillDetail">按今日宜穿色自动挑选</el-button>
      </el-form>
    </template>

    <template #footer>
      <el-button @click="detailVisible = false">取消</el-button>
      <el-button :loading="detailSaving" @click="saveDetail(false)">保存草稿</el-button>
      <el-button type="primary" :loading="detailSaving" @click="saveDetail(true)">保存并发布</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.hint {
  color: #8b806f;
  font-size: 12px;
}

.scope-alert {
  margin: 14px 18px 0;
}

.insufficient {
  color: #c45656;
}

.result-alert,
.detail-alert {
  margin-bottom: 16px;
}

.overwrite-option {
  display: block;
  margin: -4px 0 16px;
  color: #6c6255;
  font-size: 12px;
}

.detail-desc {
  margin-bottom: 16px;
}

.detail-form {
  margin-top: 8px;
}
</style>
