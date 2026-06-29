<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { EditPen } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { ContentConfig } from '@/types/domain'

const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const list = ref<ContentConfig[]>([])
const form = reactive<ContentConfig>({
  key: 'about',
  title: '',
  content: '',
  locale: 'zh-CN',
  status: 'draft'
})

const keyLabels: Record<ContentConfig['key'], string> = {
  about: '灵序穿搭简介',
  user_agreement: '用户协议',
  privacy: '隐私政策',
  share_copy: '分享文案'
}

async function load() {
  loading.value = true
  try {
    const result = await callAdminApi<PageResult<ContentConfig>>('content.list', {
      page: 1,
      pageSize: 20
    })
    list.value = result.list
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
  if (!form.title || !form.content) {
    ElMessage.warning('标题和内容不能为空')
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
    eyebrow="Content configuration"
    title="内容配置"
    description="简介、协议和分享文案由后台维护，小程序保留本地兜底文案。"
  >
    <el-button type="primary" :icon="EditPen" @click="edit()">新增内容</el-button>
  </PageHeader>

  <section class="content-grid" v-loading="loading">
    <article v-for="item in list" :key="item.key" class="surface content-card">
      <div class="content-meta">
        <span>{{ item.key }}</span>
        <el-tag :type="item.status === 'published' ? 'success' : 'info'">{{ item.status }}</el-tag>
      </div>
      <h2>{{ item.title || keyLabels[item.key] }}</h2>
      <p>{{ item.content }}</p>
      <div class="content-footer">
        <small>v{{ item.version || 1 }} · {{ item.locale }}</small>
        <el-button link type="primary" @click="edit(item)">编辑内容</el-button>
      </div>
    </article>
    <div v-if="!loading && list.length === 0" class="surface empty-note">
      暂无内容配置，请先创建“灵序穿搭简介”。
    </div>
  </section>

  <el-drawer v-model="drawerVisible" title="编辑内容" size="600px">
    <el-form label-position="top">
      <el-form-item label="内容类型">
        <el-select v-model="form.key" style="width: 100%">
          <el-option v-for="(label, key) in keyLabels" :key="key" :label="label" :value="key" />
        </el-select>
      </el-form-item>
      <el-form-item label="标题"><el-input v-model="form.title" maxlength="80" /></el-form-item>
      <el-form-item label="正文">
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
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  letter-spacing: .1em;
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
</style>
