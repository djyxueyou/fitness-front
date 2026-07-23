function avatarErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'errMsg' in error) {
    return String((error as { errMsg?: unknown }).errMsg || '')
  }
  return typeof error === 'string' ? error : ''
}

export function isAvatarSelectionCancelled(error: unknown) {
  const message = avatarErrorMessage(error).trim().toLowerCase()
  return message === 'cancel' || /(?:^|:)fail cancel(?:$|\s)/.test(message)
}

export async function cleanupAvatarTempFiles(
  paths: string[],
  remove: (path: string) => Promise<void>
) {
  const uniquePaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))]
  await Promise.allSettled(uniquePaths.map((path) => remove(path)))
}
