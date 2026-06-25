import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchMembershipValue } from '@/api/membership'
import { routes } from '@/utils/navigation'

let resolver: ((value: boolean) => void) | null = null

function defaultDescription(featureName: string) {
  if (featureName.includes('收藏')) {
    return '开通会员后可收藏常用动作，训练和动作库中都能快速找到。'
  }
  if (featureName.includes('训练计划') || featureName.includes('计划')) {
    return '开通会员后可复制系统计划，并编辑自己的多周训练安排。'
  }
  if (featureName.includes('分析') || featureName.includes('报告')) {
    return '开通会员后可查看训练容量趋势、肌群分布、PR 变化和长期训练报告。'
  }
  if (featureName.includes('自定义动作') || featureName.includes('动作')) {
    return '开通会员后可创建只属于你的动作库，支持自重、负重和计时类型。'
  }
  if (featureName.includes('自定义模板') || featureName.includes('模板')) {
    return '开通会员后可自由创建、复制和编辑训练模板。'
  }
  if (featureName.includes('训练')) {
    return '本周免费训练次数已用完，开通会员后可继续保存训练记录。'
  }
  return `开通会员后可继续使用「${featureName}」。`
}

export const useMembershipPromptStore = defineStore('membershipPrompt', () => {
  const visible = ref(false)
  const title = ref('会员功能')
  const description = ref('')
  const bullets = ref<string[]>([])
  const primaryActionText = ref('开通会员')
  const entryPoint = ref('')

  function open(featureName: string, customDescription?: string, valueEntryPoint?: string) {
    resolver?.(false)
    title.value = '会员功能'
    description.value = customDescription || defaultDescription(featureName)
    bullets.value = []
    primaryActionText.value = '开通会员'
    entryPoint.value = valueEntryPoint || ''
    visible.value = true

    if (valueEntryPoint) {
      void fetchMembershipValue(valueEntryPoint)
        .then((value) => {
          if (!visible.value || entryPoint.value !== valueEntryPoint) return
          title.value = value.title
          description.value = value.description
          bullets.value = value.bullets || []
          primaryActionText.value = value.primaryActionText || primaryActionText.value
        })
        .catch((err) => {
          console.error('[membership] value explanation failed', err)
        })
    }

    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function close(result = false) {
    visible.value = false
    bullets.value = []
    entryPoint.value = ''
    resolver?.(result)
    resolver = null
  }

  function goMembership() {
    const targetEntry = entryPoint.value
    close(false)
    const query = targetEntry ? `?entry=${encodeURIComponent(targetEntry)}` : ''
    uni.navigateTo({ url: `${routes.membership}${query}` })
  }

  return {
    visible,
    title,
    description,
    bullets,
    primaryActionText,
    open,
    close,
    goMembership
  }
})
