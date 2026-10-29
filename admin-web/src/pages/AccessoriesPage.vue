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
import type { Accessory } from '@/types/domain'

type AccessoryRow = Accessory & { imagePreviewUrl: string }

const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const accessoryFormRef = ref<FormInstance>()
const list = ref<AccessoryRow[]>([])
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
const selectedRows = ref<AccessoryRow[]>([])
const batchWorking = ref(false)
const batchEditVisible = ref(false)
const batchPriority = ref(0)

function onSelectionChange(rows: AccessoryRow[]) {
  selectedRows.value = rows
}

const blankAccessory = (): Accessory => ({
  name: '',
  description: '',
  imageUrl: '',
  primaryColorCodes: [],
  elementCodes: [],
  sceneCodes: [],
  accessoryTypeCode: '',
  priority: 0,
  status: 'draft'
})
const form = reactive<Accessory>(blankAccessory())
const required = (message: string) => ({ required: true, message, trigger: 'blur' })
const accessoryRules: FormRules<Accessory> = {
  imageUrl: [{ required: true, message: '请上传配饰图片或填写 CloudBase 文件ID', trigger: 'change' }],
  name: [required('请填写名称')],
  description: [required('请填写说明')],
  primaryColorCodes: [{ type: 'array', required: true, message: '请选择主色', trigger: 'change' }],
  sceneCodes: [{ type: 'array', required: true, message: '请选择场景标签', trigger: 'change' }],
  accessoryTypeCode: [{ required: true, message: '请选择配饰类型', trigger: 'change' }]
}
// 校验失败时用于把字段名翻译成中文提示
const accessoryFieldLabels: Record<string, string> = {
  imageUrl: '配饰图片',
  name: '名称',
  description: '说明',
  primaryColorCodes: '主色',
  sceneCodes: '场景标签',
  accessoryTypeCode: '配饰类型'
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

function normalizeAccessory(row: Accessory | any): AccessoryRow {
  return {
    ...blankAccessory(),
    ...row,
    primaryColorCodes: toTagArray(row?.primaryColorCodes),
    elementCodes: toTagArray(row?.elementCodes),
    sceneCodes: toTagArray(row?.sceneCodes),
    imagePreviewUrl: ''
  }
}

async function load() {
  loading.value = true
  try {
    const data = await callAdminApi<PageResult<Accessory>>('accessories.list', query)
    const normalized = data.list.map(normalizeAccessory)
    const previewUrls = await resolveCloudFileUrls(normalized.map(item => item.imageUrl))
    list.value = normalized.map(item => ({
      ...item,
      imagePreviewUrl: previewUrls[item.imageUrl] || ''
    }))
    total.value = data.total
  } catch (error: any) {
    ElMessage.error(error?.message || '配饰列表加载失败')
  } finally {
    loading.value = false
  }
}

// 彻底重置表单：先删掉上次编辑残留的键（_id/version/imagePreviewUrl 等），
// 否则"先编辑再新增"会带着旧 _id 提交，把上一条记录覆盖掉
function resetForm(source?: Record<string, unknown>) {
  Object.keys(form).forEach(key => delete (form as Record<string, unknown>)[key])
  Object.assign(form, blankAccessory(), source || {})
}

function edit(row?: Accessory | any) {
  resetForm(row ? JSON.parse(JSON.stringify(row)) : undefined)
  drawerVisible.value = true
}

async function save() {
  const formRef = accessoryFormRef.value
  if (!formRef) return
  try {
    await formRef.validate()
  } catch (invalid) {
    // 校验失败必须给明确提示，否则表现为"点保存没反应"
    const missing = Object.keys((invalid || {}) as Record<string, unknown>)
      .map(key => accessoryFieldLabels[key] || key)
    ElMessage.warning(
      missing.length ? `请先完成必填项：${missing.join('、')}` : '请检查表单必填项'
    )
    return
  }
  saving.value = true
  try {
    await callAdminApi('accessories.save', { ...form })
    ElMessage.success('配饰已保存')
    drawerVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function setStatus(row: Accessory | any) {
  const status = row.status === 'published' ? 'disabled' : 'published'
  try {
    await ElMessageBox.confirm(
      `确认将“${row.name}”设置为${status === 'published' ? '已发布' : '已下架'}？`,
      '状态确认',
      { center: true, confirmButtonText: '确认', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await callAdminApi('accessories.setStatus', {
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

async function removeRow(row: AccessoryRow | Record<string, unknown>) {
  // el-table 插槽的 row 为 DefaultRow，这里收敛为列表行类型
  const target = row as AccessoryRow
  try {
    await ElMessageBox.confirm(
      `确认删除“${target.name}”？删除后小程序端将不再展示该配饰。`,
      '删除确认',
      { type: 'warning', center: true, confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await callAdminApi('accessories.remove', { id: target._id, version: target.version })
    ElMessage.success('已删除')
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '删除失败')
  }
}

// 批量执行：逐条调用，汇总成功/失败结果
async function runBatch(
  rows: AccessoryRow[],
  task: (row: AccessoryRow) => Promise<unknown>,
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
      failed.push(`${row.name || '未命名'}（${error?.message || '失败'}）`)
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
      `确认批量发布选中的 ${rows.length} 条配饰？信息不完整的条目会发布失败。`,
      '批量发布',
      { center: true, confirmButtonText: '发布', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await runBatch(
    rows,
    row => callAdminApi('accessories.setStatus', {
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
      `确认删除选中的 ${rows.length} 条配饰？删除后不可恢复。`,
      '批量删除',
      { type: 'warning', center: true, confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  await runBatch(
    rows,
    row => callAdminApi('accessories.remove', { id: row._id, version: row.version }),
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
    row => callAdminApi('accessories.save', { ...row, priority: batchPriority.value }),
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
    eyebrow="Accessory library"
    title="幸运配饰"
    description="配饰与五行、颜色和场景建立关联，参与每日详情页的幸运配饰匹配。"
  >
    <el-button type="primary" :icon="Plus" @click="edit()">新增配饰</el-button>
  </PageHeader>

  <section class="surface">
    <div class="toolbar">
      <el-input
        v-model="query.keyword"
        :prefix-icon="Search"
        clearable
        placeholder="搜索配饰"
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
    </div>

    <div class="table-wrap">
      <el-table v-loading="loading" :data="list" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="配饰" min-width="260">
          <template #default="{ row }">
            <div class="accessory-cell">
              <img v-if="row.imagePreviewUrl" :src="row.imagePreviewUrl" alt="" />
              <div v-else class="image-empty">暂无图</div>
              <div><strong>{{ row.name }}</strong><small>{{ row.description }}</small></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="五行" min-width="130">
          <template #default="{ row }">
            {{ dictionaryNames('element', row.elementCodes) || '待补标签' }}
          </template>
        </el-table-column>
        <el-table-column label="场景" min-width="180">
          <template #default="{ row }">
            {{ dictionaryNames('scene', row.sceneCodes) || '待补标签' }}
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row)">编辑</el-button>
            <el-button
              link
              :type="row.status === 'published' ? 'warning' : 'success'"
              @click="setStatus(row)"
            >
              {{ row.status === 'published' ? '下架' : '发布' }}
            </el-button>
            <el-button link type="danger" @click="removeRow(row)">删除</el-button>
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

  <el-drawer v-model="drawerVisible" :title="form._id ? '编辑配饰' : '新增配饰'" size="520px">
    <el-form ref="accessoryFormRef" :model="form" :rules="accessoryRules" label-position="top">
      <el-form-item label="配饰图片" prop="imageUrl">
        <MediaField v-model="form.imageUrl" folder="accessories" />
      </el-form-item>
      <el-form-item label="名称" prop="name"><el-input v-model="form.name" maxlength="40" /></el-form-item>
      <el-form-item label="说明" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="160" show-word-limit />
      </el-form-item>
      <el-form-item label="主色" prop="primaryColorCodes">
        <el-select v-model="form.primaryColorCodes" multiple filterable :multiple-limit="3" style="width: 100%">
          <el-option v-for="item in options('color')" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="自动推导五行">
        <el-tag v-for="item in elementsForColors(form.primaryColorCodes)" :key="item">
          {{ item }}
        </el-tag>
      </el-form-item>
      <el-form-item label="场景标签" prop="sceneCodes">
        <el-select v-model="form.sceneCodes" multiple filterable style="width: 100%">
          <el-option v-for="item in options('scene')" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="配饰类型" prop="accessoryTypeCode">
        <el-select v-model="form.accessoryTypeCode" filterable style="width: 100%">
          <el-option v-for="item in options('accessoryType')" :key="item.code" :label="item.name" :value="item.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="优先级">
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
      <el-form-item label="优先级（将应用到选中的配饰）">
        <el-input-number v-model="batchPriority" :min="-100" :max="100" style="width: 100%" />
      </el-form-item>
      <small class="batch-edit-hint">当前选中 {{ selectedRows.length }} 条；数值越大在匹配排序中越靠前。</small>
    </el-form>
    <template #footer>
      <el-button @click="batchEditVisible = false">取消</el-button>
      <el-button type="primary" :loading="batchWorking" @click="applyBatchEdit">应用</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.batch-edit-hint {
  color: #978b79;
  font-size: 12px;
}

.accessory-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.accessory-cell img,
.image-empty {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  background: #eee6d9;
}

.image-empty {
  display: grid;
  place-items: center;
  color: #9f927e;
  font-size: 10px;
}

.accessory-cell strong,
.accessory-cell small {
  display: block;
}

.accessory-cell small {
  margin-top: 4px;
  color: #8d8170;
  font-size: 11px;
}
</style>
