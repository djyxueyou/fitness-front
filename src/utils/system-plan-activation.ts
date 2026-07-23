import { hasApiErrorCode } from '@/api/http'

const PLAN_REPLACE_CONFIRM_REQUIRED = 40910

export async function runSystemPlanActivation(
  activate: (replaceCurrent: boolean) => Promise<unknown>,
  confirmReplacement: () => Promise<boolean>
) {
  try {
    await activate(false)
    return true
  } catch (error) {
    if (!hasApiErrorCode(error, PLAN_REPLACE_CONFIRM_REQUIRED)) throw error
  }

  if (!(await confirmReplacement())) return false
  await activate(true)
  return true
}
