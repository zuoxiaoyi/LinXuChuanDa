<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { UserRecord } from '@/types/domain'

const loading = ref(false)
const adjusting = ref(false)
const adjustVisible = ref(false)
const list = ref<UserRecord[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })
const adjustment = reactive({
  userId: '',
  userName: '',
  amount: 1,
  reason: ''
})

async function load() {
  loading.value = true
  try {
    const result = await callAdminApi<PageResult<UserRecord>>('users.list', query)
    list.value = result.list
    total.value = result.total
  } catch (error: any) {
    ElMessage.error(error?.message || '用户列表加载失败')
  } finally {
    loading.value = false
  }
}

function openAdjust(row: UserRecord | any) {
  Object.assign(adjustment, {
    userId: row._id,
    userName: row.nickName,
    amount: 1,
    reason: ''
  })
  adjustVisible.value = true
}

async function adjustPoints() {
  if (!adjustment.amount || !adjustment.reason.trim()) {
    ElMessage.warning('积分变化量和原因不能为空')
    return
  }
  await ElMessageBox.confirm(
    `确认给“${adjustment.userName}”调整${adjustment.amount}积分？该操作会写入审计和积分流水。`,
    '积分调整确认'
  )
  adjusting.value = true
  try {
    await callAdminApi('points.adjust', {
      userId: adjustment.userId,
      amount: adjustment.amount,
      reason: adjustment.reason,
      idempotencyKey: crypto.randomUUID()
    })
    ElMessage.success('积分已调整')
    adjustVisible.value = false
    await load()
  } catch (error: any) {
    ElMessage.error(error?.message || '积分调整失败')
  } finally {
    adjusting.value = false
  }
}

onMounted(load)
</script>

<template>
  <PageHeader
    eyebrow="Users and points"
    title="用户与积分"
    description="用户资料只读展示；积分必须通过带原因的调整单和积分流水变更。"
  />

  <section class="surface">
    <div class="toolbar">
      <el-input
        v-model="query.keyword"
        :prefix-icon="Search"
        clearable
        placeholder="昵称或用户ID"
        style="width: 240px"
        @keyup.enter="load"
      />
      <el-select v-model="query.status" clearable placeholder="全部状态" style="width: 140px">
        <el-option label="正常" value="active" />
        <el-option label="已停用" value="disabled" />
      </el-select>
      <el-button @click="load">查询</el-button>
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="list">
        <el-table-column label="用户" min-width="240">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="42" :src="row.avatarUrl">{{ row.nickName?.slice(0, 1) }}</el-avatar>
              <div><strong>{{ row.nickName || '微信用户' }}</strong><small>{{ row._id }}</small></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="当前积分" width="110" />
        <el-table-column prop="totalPoints" label="累计积分" width="110" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'disabled' ? 'danger' : 'success'">
              {{ row.status || 'active' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastActiveAt" label="最近活跃" min-width="160" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary">查看记录</el-button>
            <el-button link type="warning" @click="openAdjust(row)">调整积分</el-button>
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

  <el-dialog v-model="adjustVisible" title="调整积分" width="460px">
    <el-form label-position="top">
      <el-form-item label="用户"><el-input :model-value="adjustment.userName" disabled /></el-form-item>
      <el-form-item label="变化量">
        <el-input-number v-model="adjustment.amount" :min="-10000" :max="10000" />
      </el-form-item>
      <el-form-item label="调整原因">
        <el-input v-model="adjustment.reason" type="textarea" :rows="4" maxlength="200" show-word-limit />
      </el-form-item>
      <el-alert title="禁止填写目标余额，只能提交正负变化量。" type="warning" :closable="false" />
    </el-form>
    <template #footer>
      <el-button @click="adjustVisible = false">取消</el-button>
      <el-button type="primary" :loading="adjusting" @click="adjustPoints">确认调整</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-cell strong,
.user-cell small {
  display: block;
}

.user-cell small {
  max-width: 250px;
  margin-top: 4px;
  overflow: hidden;
  color: #958978;
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  text-overflow: ellipsis;
}
</style>
