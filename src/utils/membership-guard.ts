import { useMembershipStore } from '@/stores/membership'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'

export async function ensureMembershipFeature(featureName: string): Promise<boolean> {
  const loggedIn = await ensureFeatureAuth(featureName)
  if (!loggedIn) return false

  const membershipStore = useMembershipStore()
  const status = await membershipStore.refreshStatus()
  if (status.active) return true

  return new Promise((resolve) => {
    uni.showModal({
      title: '会员功能',
      content: `${featureName} 属于会员权益。新用户可试用 30 天，过期后需要开通会员继续使用。`,
      confirmText: '开通会员',
      cancelText: '暂不开通',
      confirmColor: '#ff501e',
      success: (res) => {
        if (res.confirm) {
          uni.navigateTo({ url: routes.membership })
        }
        resolve(false)
      },
      fail: () => resolve(false)
    })
  })
}
