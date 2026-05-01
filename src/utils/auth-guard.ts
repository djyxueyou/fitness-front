import { getToken } from '@/api/http'
import { bootstrapAuth } from '@/utils/auth-bootstrap'
import { emitAuthChanged } from '@/utils/auth-events'

function askLogin(featureName: string): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '微信登录',
      content: `使用${featureName}需要先登录，是否继续？`,
      confirmText: '登录',
      cancelText: '暂不登录',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}

export async function ensureFeatureAuth(featureName: string): Promise<boolean> {
  if (getToken()) {
    return true
  }

  const confirmed = await askLogin(featureName)
  if (!confirmed) {
    return false
  }

  try {
    await bootstrapAuth()
    emitAuthChanged()
    uni.showToast({ title: '登录成功', icon: 'none' })
    return true
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : '登录失败，请稍后重试'
    uni.showToast({ title: message.slice(0, 30), icon: 'none' })
    console.error('[auth] feature login failed', err)
    return false
  }
}
