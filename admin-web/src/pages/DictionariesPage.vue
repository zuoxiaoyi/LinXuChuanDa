<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { DictionaryType, TagDictionary } from '@/types/domain'

const typeLabels: Record<DictionaryType, string> = {
  element: '五行',
  color: '颜色',
  scene: '场景',
  season: '季节',
  weather: '天气',
  accessoryType: '配饰类型'
}
const types = Object.entries(typeLabels) as Array<[DictionaryType, string]>
const list = ref<TagDictionary[]>([])
const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const dictionaryFormRef = ref<FormInstance>()
const activeType = ref<DictionaryType>('color')
const blank = (): TagDictionary => ({
  type: activeType.value,
  code: '',
  name: '',
  colorHex: '#b99c6b',
  elementCode: '',
  order: 0,
  enabled: true,
  systemLocked: false
})
const form = reactive<TagDictionary>(blank())
const dictionaryRules: FormRules<TagDictionary> = {
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  code: [{ required: true, message: '请填写编码', trigger: 'blur' }],
  name: [{ required: true, message: '请填写名称', trigger: 'blur' }],
  colorHex: [{ required: true, message: '请选择色值', trigger: 'change' }],
  elementCode: [{ required: true, message: '请选择五行归属', trigger: 'change' }]
}
const filtered = computed(() => list.value
  .filter(item => item.type === activeType.value)
  .sort((a, b) => a.order - b.order))
const elements = computed(() => list.value.filter(item => item.type === 'element'))

async function load() {
  loading.value = true
  try {
    const data = await callAdminApi<PageResult<TagDictionary>>('dictionaries.list', {
      page: 1,
      pageSize: 100
    })
    list.value = data.list
  } catch (error: any) {
    ElMessage.error(error?.message || '标签字典加载失败')
  } finally {
    loading.value = false
  }
}

function edit(row?: TagDictionary | any) {
  Object.assign(form, blank(), row ? JSON.parse(JSON.stringify(row)) : {})
  drawerVisible.value = true
}

async function save() {
  const formRef = dictionaryFormRef.value
  if (!formRef) return
  try {
    await formRef.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    await callAdminApi('dictionaries.save', { ...form })
    ElMessage.success('字典已保存')
    drawerVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggle(row: TagDictionary | any) {
  try {
    await callAdminApi('dictionaries.setStatus', {
      id: row._id,
      version: row.version,
      enabled: !row.enabled
    })
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '状态更新失败')
  }
}

async function seed() {
  try {
    const result = await callAdminApi<{ created: number; skipped: number }>(
      'dictionaries.seedDefaults'
    )
    ElMessage.success(`新增${result.created}项，跳过${result.skipped}项`)
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '初始化失败')
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="Tag dictionaries"
    title="标签字典"
    description="统一维护五行、颜色、场景、季节、天气和配饰类型，避免素材出现自由文本脏数据。"
  >
    <el-button :icon="Refresh" @click="seed">初始化默认字典</el-button>
    <el-button type="primary" :icon="Plus" @click="edit()">新增字典项</el-button>
  </PageHeader>

  <section class="surface">
    <div class="toolbar">
      <el-radio-group v-model="activeType">
        <el-radio-button v-for="[value, label] in types" :key="value" :value="value">
          {{ label }}
        </el-radio-button>
      </el-radio-group>
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="filtered">
        <el-table-column prop="name" label="名称" min-width="130" />
        <el-table-column prop="code" label="编码" min-width="150" />
        <el-table-column label="颜色" width="90">
          <template #default="{ row }">
            <span v-if="row.colorHex" class="color-dot" :style="{ background: row.colorHex }" />
          </template>
        </el-table-column>
        <el-table-column label="五行归属" width="110">
          <template #default="{ row }">
            {{ elements.find(item => item.code === row.elementCode)?.name || '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="order" label="排序" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">{{ row.enabled ? '启用' : '停用' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row)">编辑</el-button>
            <el-button
              v-if="row.type !== 'element'"
              link
              :type="row.enabled ? 'warning' : 'success'"
              @click="toggle(row)"
            >
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </section>

  <el-drawer v-model="drawerVisible" :title="form._id ? '编辑字典项' : '新增字典项'" size="480px">
    <el-form ref="dictionaryFormRef" :model="form" :rules="dictionaryRules" label-position="top">
      <el-form-item label="类型" prop="type">
        <el-select v-model="form.type" :disabled="Boolean(form._id)" style="width: 100%">
          <el-option v-for="[value, label] in types" :key="value" :label="label" :value="value" />
        </el-select>
      </el-form-item>
      <el-form-item label="编码" prop="code">
        <el-input v-model="form.code" :disabled="Boolean(form._id)" maxlength="40" />
      </el-form-item>
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" maxlength="40" />
      </el-form-item>
      <template v-if="form.type === 'color'">
        <el-form-item label="色值" prop="colorHex">
          <el-color-picker v-model="form.colorHex" />
        </el-form-item>
        <el-form-item label="五行归属" prop="elementCode">
          <el-select v-model="form.elementCode" style="width: 100%">
            <el-option v-for="item in elements" :key="item.code" :label="item.name" :value="item.code" />
          </el-select>
        </el-form-item>
      </template>
      <el-form-item label="排序">
        <el-input-number v-model="form.order" :min="-1000" :max="1000" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="drawerVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.color-dot {
  display: inline-block;
  width: 22px;
  height: 22px;
  border: 1px solid #d7c9b2;
  border-radius: 50%;
}
</style>
