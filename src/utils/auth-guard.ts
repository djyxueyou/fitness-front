import { getToken } from '@/api/http'
import { bootstrapAuth } from '@/utils/auth-bootstrap'
import { emitAuthChanged } from '@/utils/auth-events'
import { routes } from '@/utils/navigation'

let pendingLoginPromise: Promise<boolean> | null = null

function fallbackAskLogin(featureName: string): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '微信一键登录',
      content: `使用${featureName}需要先登录。\n\n登录表示你已阅读并同意《用户协议》和《隐私政策》。本应用仅使用微信登录能力建立你的训练账号，训练记录只保存在你的账号下；动作指导仅供训练参考，不构成医疗建议。`,
      confirmText: '同意并登录',
      cancelText: '暂不登录',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}

function openLoginPage(featureName: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (value: boolean) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    uni.navigateTo({
      url: `${routes.authLogin}?featureName=${encodeURIComponent(featureName)}`,
      events: {
        authorized: (value: boolean) => settle(!!value)
      },
      success: (res) => {
        res.eventChannel?.on('authorized', (value: boolean) => settle(!!value))
      },
      fail: async (err) => {
        console.error('[auth] open login page failed', err)
        const confirmed = await fallbackAskLogin(featureName)
        if (!confirmed) {
          settle(false)
          return
        }

        try {
          await bootstrapAuth()
          emitAuthChanged()
          uni.showToast({ title: '登录成功', icon: 'none' })
          settle(true)
        } catch (loginErr) {
          const message =
            loginErr instanceof Error && loginErr.message
              ? loginErr.message
              : '登录失败，请稍后重试'
          uni.showToast({ title: message.slice(0, 30), icon: 'none' })
          console.error('[auth] fallback login failed', loginErr)
          settle(false)
        }
      }
    })
  })
}

export async function ensureFeatureAuth(featureName: string): Promise<boolean> {
  if (getToken()) {
    return true
  }

  if (!pendingLoginPromise) {
    pendingLoginPromise = openLoginPage(featureName).finally(() => {
      pendingLoginPromise = null
    })
  }
  return pendingLoginPromise
}
