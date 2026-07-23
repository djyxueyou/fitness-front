export type ProfileEditableField = 'nickname' | 'height'

export type ProfileFieldValidation = { value: string | number | null } | { error: string }

export function validateProfileField(
  field: ProfileEditableField,
  rawValue: string
): ProfileFieldValidation {
  const value = rawValue.trim()
  if (field === 'nickname') {
    if (!value) return { error: '请输入昵称' }
    if (value.length < 2) return { error: '昵称至少 2 个字符' }
    if (value.length > 20) return { error: '昵称不能超过 20 个字符' }
    return { value }
  }

  if (!value) return { value: null }
  const height = Number(value)
  if (!Number.isFinite(height) || height < 80 || height > 250) {
    return { error: '身高需在 80-250 之间' }
  }
  return { value: Number(height.toFixed(1)) }
}
