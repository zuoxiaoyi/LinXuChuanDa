<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, Search, Upload } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import MediaField from '@/components/MediaField.vue'
import { useDictionaries } from '@/composables/useDictionaries'
import { callAdminApi } from '@/services/admin-api'
import { resolveCloudFileUrls, uploadAdminImage } from '@/services/media'
import { parseOutfitFilename, parseCsv, splitTags } from '@/utils/outfitBatch'
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

// ===================== 批量上传素材 =====================
const batchUploadVisible = ref(false)
const uploadMode = ref<'filename' | 'csv'>('filename')
const batchRows = ref<BatchRow[]>([])
const batchUploading = ref(false)
const batchProgress = ref(0)
const imageInputRef = ref<HTMLInputElement>()
const csvInputRef = ref<HTMLInputElement>()

interface BatchRow {
  file: File
  coverPreview: string
  title: string
  description: string
  sceneNames: string[]
  primaryColorNames: string[]
  seasonNames: string[]
  weatherNames: string[]
  accentColorNames: string[]
  temperatureMin: number
  temperatureMax: number
  waterproof: boolean
  windproof: boolean
  breathable: boolean
  priority: number
  inventoryStatus: 'available' | 'unavailable'
}

function stripExtLocal(name: string): string {
  return (name || '').replace(/\.[^.]+$/, '')
}

function openBatchUpload() {
  batchRows.value = []
  uploadMode.value = 'filename'
  batchProgress.value = 0
  batchUploadVisible.value = true
}

function makeRowFromFile(file: File): BatchRow {
  const parsed = parseOutfitFilename(file.name)
  return {
    file,
    coverPreview: URL.createObjectURL(file),
    title: parsed.title,
    description: parsed.title,
    sceneNames: splitTags(parsed.scene),
    primaryColorNames: splitTags(parsed.primaryColor),
    seasonNames: splitTags(parsed.season),
    weatherNames: splitTags(parsed.weather),
    accentColorNames: [],
    temperatureMin: 15,
    temperatureMax: 28,
    waterproof: false,
    windproof: false,
    breathable: false,
    priority: 0,
    inventoryStatus: 'available'
  }
}

function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || []).filter(f => f.type.startsWith('image/'))
  if (!files.length) return
  const seen = new Set(batchRows.value.map(r => `${r.file.name}__${r.file.size}`))
  const added = files
    .filter(f => !seen.has(`${f.name}__${f.size}`))
    .map(makeRowFromFile)
  if (added.length) batchRows.value = [...batchRows.value, ...added]
  input.value = '' // 允许再次选择同一文件
}

function removeRowAt(index: number) {
  const row = batchRows.value[index]
  if (row?.coverPreview) URL.revokeObjectURL(row.coverPreview)
  batchRows.value.splice(index, 1)
}

function resetBatch() {
  batchRows.value.forEach(r => r.coverPreview && URL.revokeObjectURL(r.coverPreview))
  batchRows.value = []
  uploadMode.value = 'filename'
}

// 把中文标签名映射成字典 code，并收集无法匹配的标签
function resolveCodes(type: Parameters<typeof options>[0], names: string[]) {
  const opts = options(type)
  const codes: string[] = []
  const unknown: string[] = []
  names.forEach(name => {
    const hit = opts.find(o => o.name === name)
    if (hit) codes.push(hit.code)
    else if (name) unknown.push(name)
  })
  return { codes, unknown }
}

// 逐行校验：缺名称 / 标签未匹配 / 温度倒挂
function rowErrors(row: any): string[] {
  const errors: string[] = []
  if (!row.title.trim()) errors.push('缺名称')
  const map: Array<[Parameters<typeof options>[0], string[], string]> = [
    ['scene', row.sceneNames, '场景'],
    ['color', row.primaryColorNames, '主色'],
    ['season', row.seasonNames, '季节'],
    ['weather', row.weatherNames, '天气']
  ]
  map.forEach(([type, names, label]) => {
    const { unknown } = resolveCodes(type, names)
    if (unknown.length) errors.push(`${label}未匹配:${unknown.join('/')}`)
  })
  if (
    Number.isFinite(row.temperatureMin) &&
    Number.isFinite(row.temperatureMax) &&
    row.temperatureMin > row.temperatureMax
  ) {
    errors.push('最低温>最高温')
  }
  return errors
}

function buildPayload(row: BatchRow, fileID: string) {
  const scene = resolveCodes('scene', row.sceneNames)
  const primary = resolveCodes('color', row.primaryColorNames)
  const accent = resolveCodes('color', row.accentColorNames)
  const season = resolveCodes('season', row.seasonNames)
  const weather = resolveCodes('weather', row.weatherNames)
  return {
    title: row.title.trim(),
    description: (row.description || row.title).trim(),
    coverUrl: fileID,
    primaryColorCodes: primary.codes,
    accentColorCodes: accent.codes,
    sceneCodes: scene.codes,
    seasonCodes: season.codes,
    weatherCodes: weather.codes,
    elementCodes: [],
    temperatureMin: Number.isFinite(row.temperatureMin) ? row.temperatureMin : 15,
    temperatureMax: Number.isFinite(row.temperatureMax) ? row.temperatureMax : 28,
    waterproof: row.waterproof,
    windproof: row.windproof,
    breathable: row.breathable,
    inventoryStatus: row.inventoryStatus,
    priority: row.priority,
    status: 'draft'
  }
}

async function submitBatch() {
  const rows = batchRows.value
  if (!rows.length) {
    ElMessage.warning('请先选择图片')
    return
  }
  const preErrors = rows.flatMap(r => rowErrors(r))
  if (preErrors.length) {
    ElMessage.warning('存在未匹配的标签或缺失名称，请先在预览中修正后再提交')
    return
  }
  batchUploading.value = true
  batchProgress.value = 0
  let ok = 0
  const failed: string[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const fileID = await uploadAdminImage(row.file, 'outfits')
      await callAdminApi('outfits.save', buildPayload(row, fileID))
      ok += 1
    } catch (err: any) {
      failed.push(`${row.title || row.file.name}（${err?.message || '失败'}）`)
    } finally {
      batchProgress.value = Math.round(((i + 1) / rows.length) * 100)
    }
  }
  batchUploading.value = false
  if (failed.length) {
    ElMessage.warning(`批量上传完成：成功 ${ok} 套，失败 ${failed.length} 套 —— ${failed.join('；')}`)
  } else {
    ElMessage.success(`批量上传完成，共 ${ok} 套`)
  }
  await load()
  if (!failed.length) batchUploadVisible.value = false
}

// ----- CSV 模式 -----
function onCsvPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  file.text().then(applyCsv).catch(() => ElMessage.error('CSV 读取失败'))
  input.value = ''
}

function applyCsv(text: string) {
  const { rows } = parseCsv(text)
  let matched = 0
  for (const row of batchRows.value) {
    const base = stripExtLocal(row.file.name)
    const match = rows.find(r => {
      const fn = stripExtLocal(r['文件名'] || r['文件名称'] || '')
      return fn && fn === base
    })
    if (match) {
      fillRowFromCsv(row, match)
      matched += 1
    }
  }
  ElMessage.info(`CSV 已应用，匹配到 ${matched} / ${batchRows.value.length} 张图片`)
}

function fillRowFromCsv(row: BatchRow, data: Record<string, string>) {
  if (data['穿搭名称']) row.title = data['穿搭名称']
  if (data['搭配说明']) row.description = data['搭配说明']
  if (data['场景标签']) row.sceneNames = splitTags(data['场景标签'])
  if (data['主色']) row.primaryColorNames = splitTags(data['主色'])
  if (data['辅助色']) row.accentColorNames = splitTags(data['辅助色'])
  if (data['季节标签']) row.seasonNames = splitTags(data['季节标签'])
  if (data['天气标签']) row.weatherNames = splitTags(data['天气标签'])
  if (data['最低温度'] && !Number.isNaN(Number(data['最低温度']))) {
    row.temperatureMin = Number(data['最低温度'])
  }
  if (data['最高温度'] && !Number.isNaN(Number(data['最高温度']))) {
    row.temperatureMax = Number(data['最高温度'])
  }
  if (data['运营优先级'] && !Number.isNaN(Number(data['运营优先级']))) {
    row.priority = Number(data['运营优先级'])
  }
  row.inventoryStatus = /不可用/.test(data['库存状态'] || '') ? 'unavailable' : 'available'
  row.waterproof = /是|true|1/i.test(data['防水'] || '')
  row.windproof = /是|true|1/i.test(data['防风'] || '')
  row.breathable = /是|true|1/i.test(data['透气'] || '')
}

function downloadTemplate() {
  const header =
    '文件名,穿搭名称,搭配说明,场景标签,主色,辅助色,季节标签,天气标签,最低温度,最高温度,防水,防风,透气,运营优先级,库存状态'
  const sample = '白色连衣裙｜商超｜白｜夏｜晴,白色连衣裙,适合通勤简约风,商超,白,,夏,晴,15,28,否,否,是,0,可用'
  const content = '﻿' + header + '\n' + sample + '\n'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '穿搭批量上传模板.csv'
  a.click()
  URL.revokeObjectURL(url)
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
    <el-button type="warning" :icon="Upload" @click="openBatchUpload">批量上传</el-button>
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

  <el-dialog
    v-model="batchUploadVisible"
    title="批量上传穿搭素材"
    width="980px"
    top="4vh"
    :close-on-click-modal="false"
  >
    <div v-if="!batchRows.length" class="batch-drop">
      <el-icon :size="42" color="#c9b79a"><Upload /></el-icon>
      <p>选择多张穿搭图片（可多选）</p>
      <p class="batch-tip">
        文件名格式：<code>穿搭名称｜场景标签｜主色｜季节标签｜天气标签</code><br />
        例：<code>白色连衣裙｜商超｜白｜夏｜晴.jpg</code>（搭配说明自动等于名称）<br />
        分隔符用全角「｜」，字段缺失可在下方预览中补。
      </p>
      <input ref="imageInputRef" type="file" accept="image/*" multiple hidden @change="onFilesPicked" />
      <el-button type="primary" @click="imageInputRef?.click()">选择图片</el-button>
    </div>

    <div v-else>
      <div class="batch-toolbar">
        <el-radio-group v-model="uploadMode">
          <el-radio-button value="filename">按文件名解析</el-radio-button>
          <el-radio-button value="csv">导入 CSV 模板</el-radio-button>
        </el-radio-group>
        <el-button v-if="uploadMode === 'csv'" @click="downloadTemplate">下载模板</el-button>
        <span class="batch-count">共 {{ batchRows.length }} 张</span>
        <span class="toolbar-spacer" />
        <input
          v-if="uploadMode === 'csv'"
          ref="csvInputRef"
          type="file"
          accept=".csv,text/csv"
          hidden
          @change="onCsvPicked"
        />
        <el-button v-if="uploadMode === 'csv'" @click="csvInputRef?.click()">选择 CSV</el-button>
        <el-button @click="resetBatch">重新选择图片</el-button>
      </div>

      <p v-if="uploadMode === 'csv'" class="batch-tip">
        下载模板后，按「文件名」列（不含扩展名）与所选图片一一对应，填好其余字段再导入；未匹配到的图片保持原有解析值。
      </p>

      <el-table :data="batchRows" max-height="430" border>
        <el-table-column label="封面" width="80">
          <template #default="{ row }">
            <img v-if="row.coverPreview" :src="row.coverPreview" class="batch-thumb" alt="" />
          </template>
        </el-table-column>
        <el-table-column label="穿搭名称" width="150">
          <template #default="{ row }">
            <el-input v-model="row.title" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="搭配说明" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.description" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="场景" min-width="120">
          <template #default="{ row }">
            <el-select v-model="row.sceneNames" multiple filterable size="small" style="width: 100%">
              <el-option v-for="o in options('scene')" :key="o.code" :label="o.name" :value="o.name" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="主色" min-width="120">
          <template #default="{ row }">
            <el-select v-model="row.primaryColorNames" multiple filterable size="small" style="width: 100%">
              <el-option v-for="o in options('color')" :key="o.code" :label="o.name" :value="o.name" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="季节" min-width="110">
          <template #default="{ row }">
            <el-select v-model="row.seasonNames" multiple filterable size="small" style="width: 100%">
              <el-option v-for="o in options('season')" :key="o.code" :label="o.name" :value="o.name" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="天气" min-width="110">
          <template #default="{ row }">
            <el-select v-model="row.weatherNames" multiple filterable size="small" style="width: 100%">
              <el-option v-for="o in options('weather')" :key="o.code" :label="o.name" :value="o.name" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column v-if="uploadMode === 'csv'" label="辅助色" min-width="120">
          <template #default="{ row }">
            <el-select v-model="row.accentColorNames" multiple filterable size="small" style="width: 100%">
              <el-option v-for="o in options('color')" :key="o.code" :label="o.name" :value="o.name" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column v-if="uploadMode === 'csv'" label="温度" width="190">
          <template #default="{ row }">
            <div class="two-column">
              <el-input-number v-model="row.temperatureMin" :min="-30" :max="50" size="small" controls-position="right" />
              <el-input-number v-model="row.temperatureMax" :min="-30" :max="50" size="small" controls-position="right" />
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="uploadMode === 'csv'" label="能力" width="160">
          <template #default="{ row }">
            <el-checkbox v-model="row.waterproof">防水</el-checkbox>
            <el-checkbox v-model="row.windproof">防风</el-checkbox>
            <el-checkbox v-model="row.breathable">透气</el-checkbox>
          </template>
        </el-table-column>
        <el-table-column v-if="uploadMode === 'csv'" label="优先级" width="110">
          <template #default="{ row }">
            <el-input-number v-model="row.priority" :min="-100" :max="100" size="small" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="校验" min-width="160">
          <template #default="{ row }">
            <div v-if="!rowErrors(row).length" class="ok-tag">可上传</div>
            <el-tooltip v-else :content="rowErrors(row).join('；')">
              <div class="err-tag">{{ rowErrors(row).join('；') }}</div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" fixed="right">
          <template #default="{ row, $index }">
            <el-button link type="danger" @click="removeRowAt($index)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-progress v-if="batchUploading" :percentage="batchProgress" class="batch-progress" />
    </div>

    <template #footer>
      <el-button @click="batchUploadVisible = false">关闭</el-button>
      <el-button
        type="primary"
        :loading="batchUploading"
        :disabled="!batchRows.length"
        @click="submitBatch"
      >
        提交 {{ batchRows.length }} 套
      </el-button>
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

.batch-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 36px 16px;
  border: 1px dashed #d8c9ad;
  border-radius: 12px;
  background: #fbf7ef;
  text-align: center;
  color: #8a7e6d;
}

.batch-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: #8a7e6d;
}

.batch-tip code {
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0e8d8;
  color: #6f5b34;
  font-size: 12px;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.toolbar-spacer {
  flex: 1;
}

.batch-count {
  color: #8a7e6d;
  font-size: 12px;
}

.batch-thumb {
  width: 54px;
  height: 66px;
  border-radius: 4px 10px 10px;
  object-fit: cover;
  background: #eee6d9;
}

.ok-tag {
  color: #2fa36b;
  font-size: 12px;
}

.err-tag {
  color: #d9534f;
  font-size: 12px;
  cursor: help;
}

.batch-progress {
  margin-top: 12px;
}
</style>
