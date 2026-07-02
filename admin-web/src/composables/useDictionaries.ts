import { ref } from 'vue'
import { callAdminApi } from '@/services/admin-api'
import type { PageResult } from '@/types/api'
import type { DictionaryType, TagDictionary } from '@/types/domain'

export function useDictionaries() {
  const loading = ref(false)
  const list = ref<TagDictionary[]>([])

  async function load() {
    loading.value = true
    try {
      const data = await callAdminApi<PageResult<TagDictionary>>('dictionaries.list', {
        page: 1,
        pageSize: 100
      })
      list.value = data.list
    } finally {
      loading.value = false
    }
  }

  function options(type: DictionaryType) {
    return list.value
      .filter(item => item.type === type && item.enabled)
      .sort((a, b) => a.order - b.order)
  }

  function elementsForColors(codes: string[]) {
    const elementCodes = new Set(
      codes
        .map(code => list.value.find(item => item.type === 'color' && item.code === code)?.elementCode)
        .filter(Boolean)
    )
    return options('element')
      .filter(item => elementCodes.has(item.code))
      .map(item => item.name)
  }

  return { loading, load, options, elementsForColors }
}
