import { ApiError } from '@/api/http'
import { useMembershipPromptStore } from '@/stores/membership-prompt'
import { useTrainingHubStore } from '@/stores/training-hub'
import { routes } from '@/utils/navigation'

export function showPlanWriteError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === 40311) {
    void useMembershipPromptStore().open('自定义训练计划', error.message, 'custom_plan', {
      secondaryActionText: '管理我的计划',
      onSecondary: () => {
        useTrainingHubStore().requestPlanTab('mine')
        uni.switchTab({ url: routes.planIndex })
      }
    })
    return true
  }

  const title = error instanceof ApiError && error.message ? error.message : fallback
  uni.showToast({ title: title.slice(0, 30), icon: 'none' })
  return false
}
