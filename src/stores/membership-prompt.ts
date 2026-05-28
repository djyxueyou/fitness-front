import { ref } from 'vue'
import { defineStore } from 'pinia'
import { routes } from '@/utils/navigation'

let resolver: ((value: boolean) => void) | null = null

function defaultDescription(featureName: string) {
  if (featureName.includes('收藏')) {
    return '开通会员后可收藏常用动作，训练和动作库中都能快速找到。'
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

  function open(featureName: string, customDescription?: string) {
    resolver?.(false)
    title.value = '会员功能'
    description.value = customDescription || defaultDescription(featureName)
    visible.value = true

    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function close(result = false) {
    visible.value = false
    resolver?.(result)
    resolver = null
  }

  function goMembership() {
    close(false)
    uni.navigateTo({ url: routes.membership })
  }

  return {
    visible,
    title,
    description,
    open,
    close,
    goMembership
  }
})
