interface MiniProgramAccountInfo {
  miniProgram?: {
    version?: string
    envVersion?: string
  }
}

interface UpdateManagerCheckResult {
  hasUpdate: boolean
}

interface UpdateManager {
  onCheckForUpdate(callback: (result: UpdateManagerCheckResult) => void): void
  onUpdateReady(callback: () => void): void
  onUpdateFailed(callback: () => void): void
  applyUpdate(): void
}

interface WechatRuntime {
  getAccountInfoSync?: () => MiniProgramAccountInfo
  getUpdateManager?: () => UpdateManager
}

export interface MiniProgramVersionInfo {
  version: string
  envVersion: string
  envLabel: string
}

const ENV_LABELS: Record<string, string> = {
  develop: '开发版',
  trial: '体验版',
  release: '正式版'
}

let launchUpdateChecked = false

export function getMiniProgramVersionInfo(): MiniProgramVersionInfo {
  const miniProgram = getWechatRuntime()?.getAccountInfoSync?.().miniProgram
  const envVersion = miniProgram?.envVersion || 'unknown'
  return {
    version: miniProgram?.version || '-',
    envVersion,
    envLabel: ENV_LABELS[envVersion] || '未知环境'
  }
}

export function checkMiniProgramUpdateOnLaunch() {
  if (launchUpdateChecked) return
  launchUpdateChecked = true
  checkMiniProgramUpdate({ silentWhenNoUpdate: true })
}

export function checkMiniProgramUpdate(options: { silentWhenNoUpdate?: boolean } = {}) {
  const updateManager = getWechatRuntime()?.getUpdateManager?.()
  if (!updateManager) {
    if (!options.silentWhenNoUpdate) {
      uni.showToast({ title: '当前环境不支持小程序更新检查', icon: 'none' })
    }
    return
  }

  updateManager.onCheckForUpdate((result) => {
    if (!result.hasUpdate && !options.silentWhenNoUpdate) {
      uni.showToast({ title: '当前已是最新版本', icon: 'none' })
    }
  })

  updateManager.onUpdateReady(() => {
    uni.showModal({
      title: '新版本已准备好',
      content: '重启后即可使用最新版本。',
      confirmText: '立即重启',
      cancelText: '稍后',
      success: (result) => {
        if (result.confirm) {
          updateManager.applyUpdate()
        }
      }
    })
  })

  updateManager.onUpdateFailed(() => {
    uni.showToast({ title: '新版本下载失败，请稍后重新打开', icon: 'none' })
  })
}

function getWechatRuntime(): WechatRuntime | null {
  const runtime = (globalThis as { wx?: WechatRuntime }).wx
  return runtime || null
}
