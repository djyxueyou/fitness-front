import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchMembershipValue } from '@/api/membership'
import { routes } from '@/utils/navigation'

let resolver: ((value: boolean) => void) | null = null

export interface MembershipPromptOptions {
  secondaryActionText?: string
  onSecondary?: () => void
}

function defaultDescription(featureName: string) {
  if (featureName.includes('收藏')) {
    return '开通会员后可收藏常用动作，训练和动作库中都能快速找到。'
  }
  if (featureName.includes('训练计划') || featureName.includes('计划')) {
    return '免费版可拥有 1 个我的计划，开通会员后可无限创建、复制和编辑。'
  }
  if (featureName.includes('分析') || featureName.includes('报告')) {
    return '开通会员后可查看周统计、训练容量趋势、肌群分布、PR 变化和长期训练报告。'
  }
  if (featureName.includes('自定义动作') || featureName.includes('动作')) {
    return '免费版可创建 1 个自定义动作，开通会员后可无限创建和编辑。'
  }
  if (featureName.includes('自定义模板') || featureName.includes('模板')) {
    return '免费版可创建 1 个自定义训练模板，开通会员后可无限创建、复制和编辑。'
  }
  if (featureName.includes('训练')) {
    return '训练记录永久免费；周统计和进阶分析属于会员权益。'
  }
  return `开通会员后可继续使用「${featureName}」。`
}

export const useMembershipPromptStore = defineStore('membershipPrompt', () => {
  const visible = ref(false)
  const title = ref('会员功能')
  const description = ref('')
  const bullets = ref<string[]>([])
  const primaryActionText = ref('开通会员')
  const secondaryActionText = ref('暂不开通')
  const entryPoint = ref('')
  let secondaryAction: (() => void) | null = null

  function open(
    featureName: string,
    customDescription?: string,
    valueEntryPoint?: string,
    options: MembershipPromptOptions = {}
  ) {
    resolver?.(false)
    title.value = '会员功能'
    description.value = customDescription || defaultDescription(featureName)
    bullets.value = []
    primaryActionText.value = '开通会员'
    secondaryActionText.value = options.secondaryActionText || '暂不开通'
    secondaryAction = options.onSecondary || null
    entryPoint.value = valueEntryPoint || ''
    visible.value = true

    if (valueEntryPoint) {
      void fetchMembershipValue(valueEntryPoint)
        .then((value) => {
          if (!visible.value || entryPoint.value !== valueEntryPoint) return
          title.value = value.title
          if (!customDescription) description.value = value.description
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
    secondaryActionText.value = '暂不开通'
    secondaryAction = null
    entryPoint.value = ''
    resolver?.(result)
    resolver = null
  }

  function runSecondary() {
    const action = secondaryAction
    close(false)
    action?.()
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
    secondaryActionText,
    open,
    close,
    runSecondary,
    goMembership
  }
})
