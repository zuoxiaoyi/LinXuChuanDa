<script setup lang="ts">
import { ref, watch } from 'vue'
import type { UploadRequestOptions } from 'element-plus'
import { ElMessage } from 'element-plus'
import { Picture, Upload } from '@element-plus/icons-vue'
import { resolveCloudFileUrl, uploadAdminImage } from '@/services/media'

const props = withDefaults(defineProps<{
  modelValue: string
  folder?: string
}>(), {
  folder: 'common'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const uploading = ref(false)
const previewUrl = ref('')
let previewRequestId = 0

watch(
  () => props.modelValue,
  async value => {
    const requestId = ++previewRequestId
    const url = await resolveCloudFileUrl(value)
    if (requestId === previewRequestId) previewUrl.value = url
  },
  { immediate: true }
)

async function upload(options: UploadRequestOptions) {
  uploading.value = true
  try {
    const url = await uploadAdminImage(options.file, props.folder)
    emit('update:modelValue', url)
    options.onSuccess({ url })
  } catch (error: any) {
    options.onError(error)
    ElMessage.error(error?.message || '图片上传失败')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="media-field">
    <div class="media-preview">
      <img v-if="previewUrl" :src="previewUrl" alt="已上传图片" />
      <el-icon v-else><Picture /></el-icon>
    </div>
    <div class="media-actions">
      <el-upload
        :show-file-list="false"
        accept="image/png,image/jpeg,image/webp"
        :http-request="upload"
      >
        <el-button :icon="Upload" :loading="uploading">上传图片</el-button>
      </el-upload>
      <el-input
        :model-value="modelValue"
        placeholder="也可粘贴CloudBase文件ID"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <small>建议WebP/JPEG，单图不超过3MB；正式发布前后台还会增加尺寸压缩任务。</small>
    </div>
  </div>
</template>

<style scoped>
.media-field {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 14px;
}

.media-preview {
  width: 112px;
  height: 132px;
  display: grid;
  overflow: hidden;
  place-items: center;
  border: 1px dashed #d8c5a2;
  border-radius: 4px 14px 14px;
  color: #b9a98f;
  background: #f7f1e6;
  font-size: 28px;
}

.media-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-actions {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.media-actions small {
  color: #978b79;
  font-size: 11px;
  line-height: 1.5;
}
</style>
