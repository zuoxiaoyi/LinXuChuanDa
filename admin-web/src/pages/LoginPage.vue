<script setup lang="ts">
import { reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Key, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import {
  cloudbaseConfig,
  cloudbaseConfigured,
  cloudbaseMissingConfig,
  demoMode
} from '@/services/cloudbase'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  username: demoMode ? 'demo_admin' : '',
  password: demoMode ? 'demo_password' : ''
})

const configMessage = computed(() => {
  if (demoMode) return '当前为显式Demo模式，不连接线上数据。'
  if (!cloudbaseConfigured) {
    return `缺少配置：${cloudbaseMissingConfig.join('、')}。请在 admin-web/.env 中补充。`
  }
  return `已连接环境 ${cloudbaseConfig.envId}`
})

async function submit() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入管理员用户名和密码')
    return
  }
  try {
    await auth.login(form.username, form.password)
    const redirect = typeof route.query.redirect === 'string'
      ? route.query.redirect
      : '/'
    await router.replace(redirect)
  } catch (error: any) {
    ElMessage.error(error?.message || '登录失败')
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-story">
      <div class="story-orbit">
        <div class="orbit-track orbit-track--outer">
          <div class="orbit-body orbit-body--north"><span>木</span></div>
          <div class="orbit-body orbit-body--south"><span>金</span></div>
        </div>
        <div class="orbit-track orbit-track--middle">
          <div class="orbit-body orbit-body--east"><span>火</span></div>
          <div class="orbit-body orbit-body--west"><span>水</span></div>
        </div>
        <div class="orbit-track orbit-track--inner">
          <div class="orbit-body orbit-body--north"><span>土</span></div>
        </div>
      </div>
      <p class="story-index">LINXU / ADMINISTRATION</p>
      <h1>把每日灵感，<br />变成可运营的秩序。</h1>
      <p>
        维护穿搭素材、五行规则、每日建议和用户积分记录，
        所有发布内容都保留版本与审计轨迹。
      </p>
      <div class="story-rule" />
      <small>东方天时智慧 × 现代色彩美学</small>
    </section>

    <section class="login-panel">
      <div class="login-form">
        <p class="login-eyebrow">SECURE ACCESS</p>
        <h2>运营后台登录</h2>
        <p class="config-state" :class="{ ready: cloudbaseConfigured || demoMode }">
          {{ configMessage }}
        </p>

        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="用户名">
            <el-input
              v-model="form.username"
              :prefix-icon="User"
              autocomplete="username"
              placeholder="请输入管理员用户名"
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="form.password"
              :prefix-icon="Key"
              type="password"
              show-password
              autocomplete="current-password"
              placeholder="请输入密码"
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-button
            type="primary"
            class="login-submit"
            :loading="auth.loading"
            :disabled="!auth.isReady"
            @click="submit"
          >
            进入运营后台
          </el-button>
        </el-form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(500px, 1.08fr) minmax(460px, .92fr);
  background: #f6f1e7;
}

.login-story {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8vh 8vw;
  color: #f8f0e2;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, .05), transparent 44%),
    #2f2a23;
}

.story-index,
.login-eyebrow {
  font-family: "IBM Plex Mono", "Cascadia Mono", monospace;
  font-size: 11px;
  letter-spacing: .16em;
}

.story-index {
  color: #c9b48f;
}

.login-story h1 {
  max-width: 620px;
  margin: 18px 0;
  font-family: "Source Han Serif SC", "Noto Serif CJK SC", serif;
  font-size: clamp(42px, 5vw, 74px);
  font-weight: 500;
  line-height: 1.2;
}

.login-story > p:not(.story-index) {
  max-width: 520px;
  color: #bcb0a0;
  font-size: 15px;
  line-height: 1.9;
}

.story-rule {
  width: 84px;
  height: 1px;
  margin: 28px 0 16px;
  background: #cda96c;
}

.login-story small {
  color: #8e8375;
  letter-spacing: .12em;
}

.story-orbit {
  position: absolute;
  top: 24px;
  right: 28px;
  width: 520px;
  height: 520px;
  transform: rotate(-12deg);
}

.orbit-track {
  --orbit-duration: 32s;
  position: absolute;
  inset: 0;
  border: 1px solid rgba(205, 169, 108, .18);
  border-radius: 50%;
  animation: orbit-spin var(--orbit-duration) linear infinite;
}

.orbit-track--outer {
  border-color: rgba(205, 169, 108, .28);
}

.orbit-track--middle {
  --orbit-duration: 25s;
  inset: 55px;
  animation-direction: reverse;
}

.orbit-track--inner {
  --orbit-duration: 18s;
  inset: 130px;
}

.orbit-body {
  position: absolute;
  width: 0;
  height: 0;
}

.orbit-body--north {
  top: 0;
  left: 50%;
}

.orbit-body--east {
  top: 50%;
  right: 0;
}

.orbit-body--south {
  right: 50%;
  bottom: 0;
}

.orbit-body--west {
  top: 50%;
  left: 0;
}

.orbit-body span {
  position: absolute;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(231, 207, 166, .28);
  border-radius: 50%;
  color: rgba(231, 207, 166, .72);
  background: rgba(47, 42, 35, .72);
  box-shadow:
    0 0 18px rgba(205, 169, 108, .08),
    inset 0 0 12px rgba(205, 169, 108, .06);
  font-family: "Source Han Serif SC", serif;
  font-size: 18px;
  animation: orbit-counter-spin var(--orbit-duration) linear infinite;
}

.orbit-track--middle .orbit-body span {
  animation-direction: reverse;
}

.story-orbit:hover .orbit-track,
.story-orbit:hover .orbit-body span {
  animation-duration: calc(var(--orbit-duration) * 1.8);
}

@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}

@keyframes orbit-counter-spin {
  to { transform: translate(-50%, -50%) rotate(-360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .orbit-track,
  .orbit-body span {
    animation: none;
  }
}

.login-panel {
  display: flex;
  align-items: center;
  padding: 8vw;
}

.login-form {
  width: min(430px, 100%);
}

.login-eyebrow {
  margin: 0;
  color: #a77d3f;
}

.login-form h2 {
  margin: 10px 0 12px;
  font-family: "Source Han Serif SC", "Noto Serif CJK SC", serif;
  font-size: 36px;
  font-weight: 600;
}

.config-state {
  margin: 0 0 32px;
  color: #9a4f45;
  font-size: 13px;
}

.config-state.ready {
  color: #667b58;
}

.login-submit {
  width: 100%;
  height: 44px;
  margin-top: 8px;
}
</style>
