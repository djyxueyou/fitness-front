const PRIVACY_SUMMARY =
  '本小程序用于记录训练数据、管理动作收藏、训练模板和会员状态。登录后数据会保存到你的账号下，不会向第三方共享个人训练数据。'

export function openPrivacyPolicy() {
  const wxApi = (globalThis as unknown as { wx?: { openPrivacyContract?: (options: object) => void } }).wx
  if (wxApi?.openPrivacyContract) {
    wxApi.openPrivacyContract({
      fail: () => {
        showPrivacyFallback()
      }
    })
    return
  }

  showPrivacyFallback()
}

function showPrivacyFallback() {
  uni.showModal({
    title: '隐私政策',
    content: PRIVACY_SUMMARY,
    showCancel: false,
    confirmText: '我知道了'
  })
}
