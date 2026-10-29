<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import MediaField from '@/components/MediaField.vue'
import { useDictionaries } from '@/composables/useDictionaries'
import { callAdminApi } from '@/services/admin-api'
import { resolveCloudFileUrls } from '@/services/media'
import type { PageResult } from '@/types/api'
import type { Outfit } from '@/types/domain'

type OutfitRow = Outfit & { coverPreviewUrl: string }

const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const outfitFormRef = ref<FormInstance>()
const list = ref<OutfitRow[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })
const { load: loadDictionaries, options, elementsForColors } = useDictionaries()

// 状态中文映射
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已下架'
}
function statusLabel(status: unknown) {
  return STATUS_LABELS[String(status || '')] || String(status || '')
}
function statusTagType(status: unknown): 'success' | 'warning' | 'info' {
  const value = String(status || '')
  if (value === 'published') return 'success'
  if (value === 'disabled') return 'warning'
  return 'info'
}

// 表格多选与批量操作
const selectedRows = ref<OutfitRow[]>([])
const batchWorking = ref(false)
const batchEditVisible = ref(false)
const batchPriority = ref(0)

function onSelectionChange(rows: OutfitRow[]) {
  selectedRows.value = rows
}

const blankOutfit = (): Outfit => ({
  title: '',
  description: '',
  coverUrl: '',
  primaryColorCodes: [],
  accentColorCodes: [],
  elementCodes: [],
  sceneCodes: [],
  seasonCodes: [],
  weatherCodes: [],
  waterproof: false,
  windproof: false,
  breathable: false,
  inventoryStatus: 'available',
  priority: 0,
  status: 'draft'
})
const form = reactive<Outfit>(blankOutfit())
const required = (message: string) => ({ required: true, message, trigger: 'blur' })
const requiredChange = (message: string) => ({ required: true, message, trigger: 'change' })
const outfitRules: FormRules<Outfit> = {
  coverUrl: [requiredChange('请上传封面图或填写 CloudBase 文件ID')],
  title: [required('请填写穿搭名称')],
  description: [required('请填写搭配说明')],
  sceneCodes: [{ type: 'array', required: true, message: '请选择场景标签', trigger: 'change' }],
  primaryColorCodes: [{ type: 'array', required: true, message: '请选择主色', trigger: 'change' }],
  seasonCodes: [{ type: 'array', required: true, message: '请选择季节标签', trigger: 'change' }],
  weatherCodes: [{ type: 'array', required: true, message: '请选择天气标签', trigger: 'change' }],
  temperatureMin: [requiredChange('请填写最低温度')],
  temperatureMax: [requiredChange('请填写最高温度')]
}
// 校验失败时用于把字段名翻译成中文提示
const outfitFieldLabels: Record<string, string> = {
  coverUrl: '封面图',
  title: '穿搭名称',
  description: '搭配说明',
  sceneCodes: '场景标签',
  primaryColorCodes: '主色',
  seasonCodes: '季节标签',
  weatherCodes: '天气标签',
  temperatureMin: '最低温度',
  temperatureMax: '最高温度'
}

function toTagArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(/[,，、]/).map(item => item.trim()).filter(Boolean)
  }
  return []
}

function normalizeOutfit(row: Outfit | any): OutfitRow {
  const legacyTags = toTagArray(row?.tags)
  const sceneTags = toTagArray(row?.sceneTags)
  return {
    ...blankOutfit(),
    ...row,
    primaryColorCodes: toTagArray(row?.primaryColorCodes),
    accentColorCodes: toTagArray(row?.accentColorCodes),
    elementCodes: toTagArray(row?.elementCodes),
    sceneCodes: toTagArray(row?.sceneCodes),
    seasonCodes: toTagArray(row?.seasonCodes),
    weatherCodes: toTagArray(row?.weatherCodes),
    sceneTags: sceneTags.length ? sceneTags : legacyTags,
    coverPreviewUrl: ''
  }
}

async function load() {
  loading.value = true
  try {
    const data = await callAdminApi<PageResult<Outfit>>('outfits.list', query)
    const normalized = data.list.map(normalizeOutfit)
    const previewUrls = await resolveCloudFileUrls(normalized.map(item => item.coverUrl))
    list.value = normalized.map(item => ({
      ...item,
      coverPreviewUrl: previewUrls[item.coverUrl] || ''
    }))
    total.value = data.total
  } catch (error: any) {
    ElMessage.error(error?.message || '穿搭列表加载失败')
  } finally {
    loading.value = false
  }
}

// 彻底重置表单：先删掉上次编辑残留的键（_id/version/coverPreviewUrl 等），
// 否则"先编辑再新增"会带着旧 _id 提交，把上一条记录覆盖掉
function resetForm(source?: Record<string, unknown>) {
  Object.keys(form).forEach(key => delete (form as Record<string, unknown>)[key])
  Object.assign(form, blankOutfit(), source || {})
}

function openCreate() {
  resetForm()
  drawerVisible.value = true
}

function openEdit(row: Outfit | any) {
  resetForm(JSON.parse(JSON.stringify(row)))
  drawerVisible.value = true
}

async function save() {
  const formRef = outfitFormRef.value
  if (!formRef) return
  try {
    await formRef.validate()
  } catch (invalid) {
    // 校验失败必须给明确提示，否则表现为"点保存没反应"
    const missing = Object.keys((invalid || {}) as Record<string, unknown>)
      .map(key => outfitFieldLabels[key] || key)
    ElMessage.warning(
      missing.length ? `请先完成必填项：${missing.join('、')}` : '请检查表单必填项'
    )
    return
  }
  if (
    Number.isFinite(form.temperatureMin) &&
    Number.isFinite(form.temperatureMax) &&
    Number(form.temperatureMin) > Number(form.temperatureMax)
  ) {
    ElMessage.warning('最低温度不能高于最高温度')
    return
  }
  saving.value = true
  try {
    await callAdminApi('outfits.save', { ...form })
    ElMessage.success('穿搭素材已保存')
    drawerVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function setStatus(row: Outfit | any, status: Outfit['status']) {
  if (status === 'published') {
    const missing = [
      !row.coverUrl && '封面图',
      !row.title && '穿搭名称',
      !row.description && '搭配说明',
      !row.sceneCodes?.length && '场景标签',
      !row.primaryColorCodes?.length && '主色',
      !row.seasonCodes?.length && '季节标签',
      !row.weatherCodes?.length && '天气标签',
      !Number.isFinite(row.temperatureMin) && '最低温度',
      !Number.isFinite(row.temperatureMax) && '最高温度'
    ].filter(Boolean)
    if (missing.length) {
      ElMessage.warning(`发布穿搭还缺少：${missing.join('、')}`)
      return
    }
  }
  await ElMessageBox.confirm(
    `确认将“${row.title}”设置为${status === 'published' ? '已发布' : '已下架'}？`,
    '状态确认',
    { center: true, confirmButtonText: '确认', cancelButtonText: '取消' }
  )
  try {
    await callAdminApi('outfits.setStatus', {
      id: row._id,
      status,
      version: row.version
    })
    ElMessage.success('状态已更新')
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '状态更新失败')
  }
}

async function removeRow(row: OutfitRow | Record<string, unknown>) {
  // el-table 插槽的 row 为 DefaultRow，这里收敛为列表行类型
  const target = row as OutfitRow
  try {
    await ElMessageBox.confirm(
      `确认删除“${target.title}”？删除后小程序端将不再展示该穿搭。`,
      '删除确认',
      { type: 'warning', center: true, confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await callAdminApi('outfits.remove', { id: target._id, version: target.version })
    ElMessage.success('已删除')
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '删除失败')
  }
}

// 批量执行：逐条调用，汇总成功/失败结果
async function runBatch(
  rows: OutfitRow[],
  task: (row: OutfitRow) => Promise<unknown>,
  label: string
) {
  batchWorking.value = true
  let ok = 0
  const failed: string[] = []
  for (const row of rows) {
    try {
      await task(row)
      ok += 1
    } catch (error: any) {
      failed.push(`${row.title || '未命名'}（${error?.message || '失败'}）`)
    }
  }
  batchWorking.value = false
  if (failed.length) {
    ElMessage.warning(`${label}完成：成功 ${ok} 条，失败 ${failed.length} 条 —— ${failed.join('；')}`)
  } else {
    ElMessage.success(`${label}完成，共 ${ok} 条`)
  }
  await load()
}

async function batchPublish() {
  const rows = [...selectedRows.value]
  if (!rows.length) return
  try {
    await ElMessageBox.confirm(
      `确认批量发布选中的 ${rows.length} 套穿搭？信息不完整的条目会发布失败。`,
      '批量发布',
      { center: true, confirmButtonText: '发布', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await runBatch(
    rows,
    row => callAdminApi('outfits.setStatus', {
      id: row._id,
      status: 'published',
      version: row.version
    }),
    '批量发布'
  )
}

async function batchRemove() {
  const rows = [...selectedRows.value]
  if (!rows.length) return
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${rows.length} 套穿搭？删除后不可恢复。`,
      '批量删除',
      { type: 'warning', center: true, confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await runBatch(
    rows,
    row => callAdminApi('outfits.remove', { id: row._id, version: row.version }),
    '批量删除'
  )
}

// 批量编辑：统一修改选中行的优先级
function batchEdit() {
  if (!selectedRows.value.length) return
  batchPriority.value = 0
  batchEditVisible.value = true
}

async function applyBatchEdit() {
  const rows = [...selectedRows.value]
  batchEditVisible.value = false
  if (!rows.length) return
  await runBatch(
    rows,
    row => callAdminApi('outfits.save', { ...row, priority: batchPriority.value }),
    '批量编辑'
  )
}

function dictionaryName(type: Parameters<typeof options>[0], code: string) {
  return options(type).find(item => item.code === code)?.name || code
}

function dictionaryNames(type: Parameters<typeof options>[0], codes: unknown) {
  return toTagArray(codes).map(code => dictionaryName(type, code)).join(' · ')
}

function formatDateTime(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { hour12: false })
}

onMounted(async () => {
  await loadDictionaries()
  await load()
})
</script>

<template>
  <PageHeader
    eyebrow="Outfit library"
    title="穿搭素材"
    description="维护可参与算法匹配的穿搭图片、场景、五行、颜色、季节与天气标签。"
  >
    <el-button type="primary" :icon="Plus" @click="openCreate">新增穿搭</el-button>
  </PageHeader>

  <section class="surface">
    <div class="toolbar">
      <el-input
        v-model="query.keyword"
        clearable
        :prefix-icon="Search"
        placeholder="搜索标题"
        style="width: 240px"
        @keyup.enter="load"
      />
      <el-select v-model="query.status" clearable placeholder="全部状态" style="width: 140px">
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="已下架" value="disabled" />
      </el-select>
      <el-button @click="load">查询</el-button>
      <div class="toolbar-spacer" />
      <el-button
        type="success"
        plain
        :disabled="!selectedRows.length"
        :loading="batchWorking"
        @click="batchPublish"
      >
        批量发布
      </el-button>
      <el-button
        plain
        :disabled="!selectedRows.length"
        :loading="batchWorking"
        @click="batchEdit"
      >
        批量编辑
      </el-button>
      <el-button
        type="danger"
        plain
        :disabled="!selectedRows.length"
        :loading="batchWorking"
        @click="batchRemove"
      >
        批量删除
      </el-button>
      <span class="result-count">共 {{ total }} 套</span>
    </div>

    <div class="table-wrap">
      <el-table v-loading="loading" :data="list" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="素材" min-width="250">
          <template #default="{ row }">
            <div class="outfit-cell">
              <img v-if="row.coverPreviewUrl" :src="row.coverPreviewUrl" alt="" />
              <div v-else class="image-empty">暂无图</div>
              <div>
                <strong>{{ row.title }}</strong>
                <small>{{ row.description }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="场景" min-width="150">
          <template #default="{ row }">
            <el-tag v-for="code in row.sceneCodes" :key="code" effect="plain">
              {{ dictionaryName('scene', code) }}
            </el-tag>
            <el-tag v-if="!row.sceneCodes.length" type="warning" effect="plain">待补标签</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="五行/颜色" min-width="170">
          <template #default="{ row }">
            {{ dictionaryNames('element', row.elementCodes) || '待补标签' }}
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="编辑时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status !== 'published'"
              link
              type="success"
              @click="setStatus(row, 'published')"
            >
              发布
            </el-button>
            <el-button v-else link type="warning" @click="setStatus(row, 'disabled')">
              下架
            </el-button>
            <el-button link type="danger" @click="removeRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          layout="total, prev, pager, next"
          :total="total"
          @current-change="load"
        />
      </div>
    </div>
  </section>

  <el-drawer v-model="drawerVisible" :title="form._id ? '编辑穿搭' : '新增穿搭'" size="560px">
    <el-form ref="outfitFormRef" :model="form" :rules="outfitRules" label-position="top">
      <el-form-item label="封面图" prop="coverUrl">
        <MediaField v-model="form.coverUrl" folder="outfits" />
      </el-form-item>
      <el-form-item label="穿搭名称" prop="title">
        <el-input v-model="form.title" maxlength="50" show-word-limit />
      </el-form-item>
      <el-form-item label="搭配说明" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="4" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="场景标签" prop="sceneCodes">
        <el-select v-model="form.sceneCodes" multiple filterable style="width: 100%">
          <el-option v-for="item in options('scene')" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="主色" prop="primaryColorCodes">
        <el-select v-model="form.primaryColorCodes" multiple filterable :multiple-limit="3" style="width: 100%">
          <el-option v-for="item in options('color')" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="辅助色">
        <el-select v-model="form.accentColorCodes" multiple filterable style="width: 100%">
          <el-option v-for="item in options('color')" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="自动推导五行">
        <el-tag
          v-for="item in elementsForColors([...form.primaryColorCodes, ...form.accentColorCodes])"
          :key="item"
        >
          {{ item }}
        </el-tag>
      </el-form-item>
      <el-form-item label="季节标签" prop="seasonCodes">
        <el-select v-model="form.seasonCodes" multiple style="width: 100%">
          <el-option v-for="item in options('season')" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="天气标签" prop="weatherCodes">
        <el-select v-model="form.weatherCodes" multiple style="width: 100%">
          <el-option v-for="item in options('weather')" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
      </el-form-item>
      <div class="two-column">
        <el-form-item label="最低温度" prop="temperatureMin">
          <el-input-number v-model="form.temperatureMin" :min="-30" :max="50" />
        </el-form-item>
        <el-form-item label="最高温度" prop="temperatureMax">
          <el-input-number v-model="form.temperatureMax" :min="-30" :max="50" />
        </el-form-item>
      </div>
      <el-form-item label="库存状态">
        <el-radio-group v-model="form.inventoryStatus">
          <el-radio value="available">可用</el-radio>
          <el-radio value="unavailable">不可用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="服装能力">
        <el-checkbox v-model="form.waterproof">防水</el-checkbox>
        <el-checkbox v-model="form.windproof">防风</el-checkbox>
        <el-checkbox v-model="form.breathable">透气</el-checkbox>
      </el-form-item>
      <el-form-item label="运营优先级">
        <el-input-number v-model="form.priority" :min="-100" :max="100" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="drawerVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-drawer>

  <el-dialog
    v-model="batchEditVisible"
    title="批量编辑"
    width="400px"
    align-center
  >
    <el-form label-position="top">
      <el-form-item label="运营优先级（将应用到选中的穿搭）">
        <el-input-number v-model="batchPriority" :min="-100" :max="100" style="width: 100%" />
      </el-form-item>
      <small class="batch-edit-hint">当前选中 {{ selectedRows.length }} 套；数值越大在匹配排序中越靠前。</small>
    </el-form>
    <template #footer>
      <el-button @click="batchEditVisible = false">取消</el-button>
      <el-button type="primary" :loading="batchWorking" @click="applyBatchEdit">应用</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.batch-edit-hint {
  color: #8a7e6d;
  font-size: 12px;
}

.result-count {
  color: #8a7e6d;
  font-size: 12px;
}

.outfit-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.outfit-cell img,
.image-empty {
  width: 54px;
  height: 66px;
  flex: 0 0 auto;
  border-radius: 4px 10px 10px;
  object-fit: cover;
  background: #eee6d9;
}

.image-empty {
  display: grid;
  place-items: center;
  color: #a39784;
  font-size: 10px;
}

.outfit-cell strong,
.outfit-cell small {
  display: block;
}

.outfit-cell small {
  max-width: 260px;
  margin-top: 5px;
  overflow: hidden;
  color: #8a7f70;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.el-tag + .el-tag {
  margin-left: 5px;
}

.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
</style>
