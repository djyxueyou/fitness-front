import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ApiError } from '@/api/http'
import { useMembershipStore } from '@/stores/membership'
import { useMembershipPromptStore } from '@/stores/membership-prompt'

function inferEntryPoint(featureName: string) {
  if (featureName.includes('深度洞察') || featureName.includes('训练分析'))
    return 'advanced_analytics'
  if (featureName.includes('训练建议') || featureName.includes('进阶'))
    return 'progression_recommendation'
  if (featureName.includes('训练计划')) return 'custom_plan'
  if (featureName.includes('模板')) return 'custom_template'
  return undefined
}

export async function ensureMembershipFeature(
  featureName: string,
  entryPoint?: string
): Promise<boolean> {
  const authed = await ensureFeatureAuth(featureName)
  if (!authed) return false

  // Scheme A gives every user one custom exercise, template, and plan.
  // The server owns the atomic quota check; Pro prompts are shown only when
  // that free quota is actually exceeded.
  if (
    featureName.includes('自定义动作') ||
    featureName.includes('自定义模板') ||
    featureName.includes('自定义训练计划')
  ) {
    return true
  }

  const membershipStore = useMembershipStore()
  try {
    const status = await membershipStore.refreshStatus()
    if (status.active) {
      return true
    }
  } catch (err) {
    console.error('[membership] status check failed', err)
    uni.showToast({ title: '会员状态读取失败', icon: 'none' })
    return false
  }

  return useMembershipPromptStore().open(
    featureName,
    undefined,
    entryPoint || inferEntryPoint(featureName)
  )
}

export function handleMembershipRequiredError(
  error: unknown,
  featureName: string,
  entryPoint?: string
) {
  if (!(error instanceof ApiError) || error.code !== 40311) return false
  void useMembershipPromptStore().open(
    featureName,
    error.message,
    entryPoint || inferEntryPoint(featureName)
  )
  return true
}
