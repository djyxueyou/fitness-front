export type CustomExerciseFormMode = 'create' | 'edit'

export interface CustomExerciseOption {
  value: string
  label: string
}

export function initialCustomExerciseCategory(mode: CustomExerciseFormMode, categoryCode = '') {
  if (mode === 'create' || categoryCode === 'custom') return ''
  return categoryCode
}

export function canSubmitCustomExercise(name: string) {
  return !!name.trim()
}

export function initialCustomExerciseEquipment(
  mode: CustomExerciseFormMode,
  recordType: string,
  equipmentCode = ''
) {
  if (mode === 'edit') return equipmentCode
  return recordType === 'BODYWEIGHT_REPS' ? 'BODYWEIGHT' : ''
}

export function normalizeCustomExerciseOption(
  value: string,
  options: CustomExerciseOption[]
): { code?: string; name?: string } {
  if (!value) return { code: undefined, name: undefined }
  const option = options.find((item) => item.value === value)
  return { code: value, name: option?.label }
}

export function normalizeCustomExerciseCategoryPayload(
  mode: CustomExerciseFormMode,
  value: string,
  options: CustomExerciseOption[]
): { code?: string; name?: string } {
  if (!value && mode === 'edit') {
    return { code: 'custom', name: '自定义' }
  }
  return normalizeCustomExerciseOption(value, options)
}
