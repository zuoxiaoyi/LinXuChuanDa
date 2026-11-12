<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { EditPen } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { ContentConfig } from '@/types/domain'

const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const contentFormRef = ref<FormInstance>()
const list = ref<ContentConfig[]>([])
const duplicateCount = ref<Record<string, number>>({})
const form = reactive<ContentConfig>({
  key: 'about',
  title: '',
  content: '',
  locale: 'zh-CN',
  status: 'draft'
})
const contentRules: FormRules<ContentConfig> = {
  key: [{ required: true, message: '请选择内容类型', trigger: 'change' }],
  title: [{ required: true, message: '请填写标题', trigger: 'blur' }],
  content: [{ required: true, message: '请填写正文', trigger: 'blur' }]
}

const keyLabels: Record<ContentConfig['key'], string> = {
  about: '灵序穿搭简介',
  user_agreement: '用户协议',
  privacy: '隐私政策',
  share_copy: '分享文案'
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已停用'
}

const localeLabels: Record<string, string> = {
  'zh-CN': '简体中文',
  'en-US': '英文'
}

// 早期写入的记录把业务字段包在 row.data 里（CloudBase Web SDK 旧写法）。
// 顶层字段优先，data 只补缺失；否则编辑保存后旧 data 会反过来覆盖新内容。
function normalizeContent(row: ContentConfig | any): ContentConfig {
  const data = row?.data && typeof row.data === 'object' ? row.data : {}
  const merged: any = {
    ...data,
    ...row,
    _id: row?._id || data._id,
    version: row?.version ?? data.version,
    createdAt: row?.createdAt || data.createdAt,
    updatedAt: row?.updatedAt || data.updatedAt
  }
  delete merged.data
  return merged
}

// 同一 key 只保留最近更新的一条；历史上重复提交产生的旧记录不重复展示。
function dedupe(rows: ContentConfig[]) {
  const grouped = new Map<string, ContentConfig[]>()
  for (const row of rows) {
    const key = row.key || '(未知类型)'
    const group = grouped.get(key) || []
    group.push(row)
    grouped.set(key, group)
  }
  const counts: Record<string, number> = {}
  const kept: ContentConfig[] = []
  for (const [key, group] of grouped) {
    group.sort((a: any, b: any) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    counts[key] = group.length - 1
    kept.push(group[0])
  }
  return { kept, counts }
}

async function load() {
  loading.value = true
  try {
    const result = await callAdminApi<PageResult<ContentConfig>>('content.list', {
      page: 1,
      pageSize: 100
    })
    const { kept, counts } = dedupe(result.list.map(normalizeContent))
    list.value = kept
    duplicateCount.value = counts
  } catch (error: any) {
    ElMessage.error(error?.message || '内容配置加载失败')
  } finally {
    loading.value = false
  }
}

function edit(row?: ContentConfig) {
  Object.assign(form, {
    key: 'about',
    title: '',
    content: '',
    locale: 'zh-CN',
    status: 'draft',
    ...(row ? JSON.parse(JSON.stringify(row)) : {})
  })
  drawerVisible.value = true
}

async function save(publish = false) {
  const formRef = contentFormRef.value
  if (!formRef) return
  try {
    await formRef.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const saved = await callAdminApi<ContentConfig>('content.save', { ...form })
    if (publish) {
      await callAdminApi('content.publish', {
        id: saved._id || form._id,
        version: saved.version || form.version
      })
    }
    ElMessage.success(publish ? '内容已发布' : '草稿已保存')
    drawerVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="文案与协议"
    title="内容配置"
    description="简介、协议和分享文案由后台维护，小程序保留本地兜底文案。"
  >
    <el-button type="primary" :icon="EditPen" @click="edit()">新增内容</el-button>
  </PageHeader>

  <el-alert
    class="content-notice"
    type="info"
    :closable="false"
    show-icon
    title="哪些内容会影响小程序"
    description="《用户协议》《隐私政策》发布为「已发布」后，小程序「协议」页会优先展示后台版本，未发布时沿用小程序内置兜底文案。「灵序穿搭简介」「分享文案」目前仅供后台留存，小程序端尚未接入，发布与否不影响线上展示。"
  />

  <section class="content-grid" v-loading="loading">
    <article v-for="item in list" :key="item.key" class="surface content-card">
      <div class="content-meta">
        <span>{{ keyLabels[item.key] || item.key }}</span>
        <el-tag :type="item.status === 'published' ? 'success' : 'info'">
          {{ statusLabels[item.status] || item.status }}
        </el-tag>
      </div>
      <h2>{{ item.title || keyLabels[item.key] }}</h2>
      <p>{{ item.content }}</p>
      <div class="content-footer">
        <small>
          v{{ item.version || 1 }} · {{ localeLabels[item.locale] || item.locale }}
          <span v-if="duplicateCount[item.key]" class="duplicate-hint">
            · 另有 {{ duplicateCount[item.key] }} 条重复记录（已折叠）
          </span>
        </small>
        <el-button link type="primary" @click="edit(item)">编辑内容</el-button>
      </div>
    </article>
    <div v-if="!loading && list.length === 0" class="surface empty-note">
      暂无内容配置，请先创建“灵序穿搭简介”。
    </div>
  </section>

  <el-drawer v-model="drawerVisible" title="编辑内容" size="600px">
    <el-form ref="contentFormRef" :model="form" :rules="contentRules" label-position="top">
      <el-form-item label="内容类型" prop="key">
        <el-select v-model="form.key" style="width: 100%">
          <el-option v-for="(label, key) in keyLabels" :key="key" :label="label" :value="key" />
        </el-select>
      </el-form-item>
      <el-form-item label="标题" prop="title"><el-input v-model="form.title" maxlength="80" /></el-form-item>
      <el-form-item label="正文" prop="content">
        <el-input v-model="form.content" type="textarea" :rows="16" maxlength="10000" show-word-limit />
      </el-form-item>
      <el-alert
        title="首版只允许纯文本，避免不受控富文本影响小程序安全与排版。"
        type="info"
        :closable="false"
      />
    </el-form>
    <template #footer>
      <el-button @click="drawerVisible = false">取消</el-button>
      <el-button :loading="saving" @click="save(false)">保存草稿</el-button>
      <el-button type="primary" :loading="saving" @click="save(true)">保存并发布</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.content-notice {
  margin-bottom: 18px;
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.content-card {
  min-height: 230px;
  padding: 24px;
}

.content-meta,
.content-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.content-meta > span {
  color: var(--gold);
  font-size: 12px;
  letter-spacing: .04em;
}

.content-card h2 {
  margin: 26px 0 10px;
  font-family: "Source Han Serif SC", serif;
  font-size: 22px;
}

.content-card p {
  height: 72px;
  margin: 0;
  overflow: hidden;
  color: #6c6255;
  font-size: 13px;
  line-height: 1.8;
}

.content-footer {
  margin-top: 22px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.content-footer small {
  color: #968a79;
}

.duplicate-hint {
  color: #b26b3f;
}
</style>
