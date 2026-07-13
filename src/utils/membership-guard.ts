import { ensureFeatureAuth } from '@/utils/auth-guard'
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
