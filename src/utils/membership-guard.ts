import { ensureFeatureAuth } from '@/utils/auth-guard'
import { useMembershipStore } from '@/stores/membership'
import { useMembershipPromptStore } from '@/stores/membership-prompt'

export async function ensureMembershipFeature(featureName: string): Promise<boolean> {
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

  return useMembershipPromptStore().open(featureName)
}
