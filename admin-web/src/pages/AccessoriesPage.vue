<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import MediaField from '@/components/MediaField.vue'
import { callAdminApi } from '@/services/admin-api'
import { resolveCloudFileUrls } from '@/services/media'
import type { PageResult } from '@/types/api'
import type { Accessory } from '@/types/domain'

type AccessoryRow = Accessory & { imagePreviewUrl: string }

const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const list = ref<AccessoryRow[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })

const blankAccessory = (): Accessory => ({
  name: '',
  description: '',
  imageUrl: '',
  colorTags: [],
  elementTags: [],
  sceneTags: [],
  priority: 0,
  status: 'draft'
})
const form = reactive<Accessory>(blankAccessory())

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
    colorTags: toTagArray(row?.colorTags),
    elementTags: toTagArray(row?.elementTags),
    sceneTags: toTagArray(row?.sceneTags),
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

function edit(row?: Accessory | any) {
  Object.assign(form, blankAccessory(), row ? JSON.parse(JSON.stringify(row)) : {})
  drawerVisible.value = true
}

async function save() {
  if (!form.name || !form.description || !form.elementTags.length) {
    ElMessage.warning('请填写名称、说明和五行标签')
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

onMounted(load)
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
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="list">
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
          <template #default="{ row }">{{ row.elementTags.join(' · ') || '—' }}</template>
        </el-table-column>
        <el-table-column label="场景" min-width="180">
          <template #default="{ row }">{{ row.sceneTags.join(' · ') || '—' }}</template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row)">编辑</el-button>
            <el-button link :type="row.status === 'published' ? 'warning' : 'success'" @click="setStatus(row)">
              {{ row.status === 'published' ? '下架' : '发布' }}
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

  <el-drawer v-model="drawerVisible" :title="form._id ? '编辑配饰' : '新增配饰'" size="520px">
    <el-form label-position="top">
      <el-form-item label="配饰图片">
        <MediaField v-model="form.imageUrl" folder="accessories" />
      </el-form-item>
      <el-form-item label="名称"><el-input v-model="form.name" maxlength="40" /></el-form-item>
      <el-form-item label="说明">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="160" show-word-limit />
      </el-form-item>
      <el-form-item label="五行标签">
        <el-select v-model="form.elementTags" multiple style="width: 100%">
          <el-option v-for="item in ['金','木','水','火','土']" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="颜色标签">
        <el-select v-model="form.colorTags" multiple allow-create filterable style="width: 100%" />
      </el-form-item>
      <el-form-item label="场景标签">
        <el-select v-model="form.sceneTags" multiple allow-create filterable style="width: 100%" />
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
</template>

<style scoped>
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
