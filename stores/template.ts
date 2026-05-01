import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { templates as seedTemplates } from '@/mock/templates'
import { deleteTemplate, fetchTemplateList, type TemplateListItemResponse } from '@/api/template'
import type { Template } from '@/types/template'

const palette = [
  { color: 'rgba(255, 80, 30, 0.15)', accent: '#ff501e' },
  { color: 'rgba(80, 200, 255, 0.15)', accent: '#50c8ff' },
  { color: 'rgba(255, 200, 80, 0.15)', accent: '#ffc850' }
]

function toTemplate(item: TemplateListItemResponse, index: number): Template {
  const theme = palette[index % palette.length]
  const isSystem = item.templateType === 'SYSTEM'
  return {
    id: item.id,
    name: item.name,
    templateType: item.templateType,
    description: item.description,
    tag: isSystem ? 'SYS' : 'MY',
    exercises: item.exerciseCount,
    duration: Math.max(20, item.exerciseCount * 10),
    level: '初级',
    muscles: item.description ? [item.description] : [isSystem ? '系统推荐' : '我的模板'],
    color: theme.color,
    accent: theme.accent
  }
}

export const useTemplateStore = defineStore('template', () => {
  const items = ref<Template[]>(seedTemplates.map((item) => ({ ...item, templateType: 'USER', muscles: [...item.muscles] })))
  const loading = ref(false)

  const userItems = computed(() => items.value.filter((item) => item.templateType !== 'SYSTEM'))
  const systemItems = computed(() => items.value.filter((item) => item.templateType === 'SYSTEM'))
  const recentItems = computed(() => userItems.value.slice(0, 3))

  async function loadTemplates() {
    loading.value = true
    try {
      const list = await fetchTemplateList()
      items.value = list.map(toTemplate)
    } catch (err) {
      console.error('[template] load failed', err)
    } finally {
      loading.value = false
    }
  }

  function getById(id: number | null) {
    return items.value.find((item) => item.id === id)
  }

  function rename(id: number, name: string) {
    items.value = items.value.map((item) => item.id === id ? { ...item, name } : item)
  }

  async function remove(id: number) {
    const target = getById(id)
    if (target?.templateType === 'SYSTEM') return
    await deleteTemplate(id)
    items.value = items.value.filter((item) => item.id !== id)
  }

  function duplicate(id: number) {
    const target = getById(id)
    if (!target) return

    const nextId = Math.max(...items.value.map((item) => item.id), 0) + 1
    items.value.unshift({
      ...target,
      id: nextId,
      templateType: 'USER',
      name: `${target.name} 副本`,
      tag: 'MY',
      muscles: [...target.muscles]
    })
  }

  return {
    items,
    userItems,
    systemItems,
    recentItems,
    loading,
    loadTemplates,
    getById,
    rename,
    remove,
    duplicate
  }
})
