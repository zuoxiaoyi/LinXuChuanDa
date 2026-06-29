<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import MediaField from '@/components/MediaField.vue'
import { callAdminApi } from '@/services/admin-api'
import { resolveCloudFileUrls } from '@/services/media'
import type { PageResult } from '@/types/api'
import type { Outfit } from '@/types/domain'

type OutfitRow = Outfit & { coverPreviewUrl: string }

const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const list = ref<OutfitRow[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })

const blankOutfit = (): Outfit => ({
  title: '',
  description: '',
  coverUrl: '',
  sceneTags: [],
  colorTags: [],
  elementTags: [],
  seasonTags: [],
  weatherTags: [],
  styleTags: [],
  priority: 0,
  status: 'draft'
})

const form = reactive<Outfit>(blankOutfit())
const tagOptions = {
  scenes: ['通勤', '休闲', '度假', '约会', '日常', '轻运动'],
  elements: ['金', '木', '水', '火', '土'],
  seasons: ['春', '夏', '秋', '冬'],
  weather: ['晴', '多云', '雨', '雪', '大风', '降温']
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
    sceneTags: sceneTags.length ? sceneTags : legacyTags,
    colorTags: toTagArray(row?.colorTags),
    elementTags: toTagArray(row?.elementTags),
    seasonTags: toTagArray(row?.seasonTags),
    weatherTags: toTagArray(row?.weatherTags),
    styleTags: toTagArray(row?.styleTags),
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

function openCreate() {
  Object.assign(form, blankOutfit())
  drawerVisible.value = true
}

function openEdit(row: Outfit | any) {
  Object.assign(form, blankOutfit(), JSON.parse(JSON.stringify(row)))
  drawerVisible.value = true
}

async function save() {
  if (!form.title || !form.description || !form.sceneTags.length) {
    ElMessage.warning('请填写名称、说明和至少一个场景标签')
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
  await ElMessageBox.confirm(
    `确认将“${row.title}”设置为${status === 'published' ? '已发布' : '已下架'}？`,
    '状态确认'
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

onMounted(load)
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
      <span class="result-count">共 {{ total }} 套</span>
    </div>

    <div class="table-wrap">
      <el-table v-loading="loading" :data="list">
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
            <el-tag v-for="tag in row.sceneTags" :key="tag" effect="plain">{{ tag }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="五行/颜色" min-width="170">
          <template #default="{ row }">
            {{ row.elementTags.concat(row.colorTags).join(' · ') || '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">
              {{ row.status }}
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
    <el-form label-position="top">
      <el-form-item label="封面图">
        <MediaField v-model="form.coverUrl" folder="outfits" />
      </el-form-item>
      <el-form-item label="穿搭名称">
        <el-input v-model="form.title" maxlength="50" show-word-limit />
      </el-form-item>
      <el-form-item label="搭配说明">
        <el-input v-model="form.description" type="textarea" :rows="4" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="场景标签">
        <el-select v-model="form.sceneTags" multiple allow-create filterable style="width: 100%">
          <el-option v-for="item in tagOptions.scenes" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="五行标签">
        <el-select v-model="form.elementTags" multiple style="width: 100%">
          <el-option v-for="item in tagOptions.elements" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="颜色标签">
        <el-select v-model="form.colorTags" multiple allow-create filterable style="width: 100%" />
      </el-form-item>
      <el-form-item label="季节标签">
        <el-select v-model="form.seasonTags" multiple style="width: 100%">
          <el-option v-for="item in tagOptions.seasons" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="天气标签">
        <el-select v-model="form.weatherTags" multiple style="width: 100%">
          <el-option v-for="item in tagOptions.weather" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <div class="two-column">
        <el-form-item label="最低温度">
          <el-input-number v-model="form.temperatureMin" :min="-30" :max="50" />
        </el-form-item>
        <el-form-item label="最高温度">
          <el-input-number v-model="form.temperatureMax" :min="-30" :max="50" />
        </el-form-item>
      </div>
      <el-form-item label="运营优先级">
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
