export interface FilterOption {
  label: string
  value: string
}

export interface ExerciseFilterMetadata {
  equipment: FilterOption[]
  difficulty: FilterOption[]
  recordTypes: FilterOption[]
}

export interface ExerciseFilterState {
  categoryCode: string
  equipmentCode: string
  difficultyCode: string
  recordType: string
}

export type AdvancedExerciseFilterKey = 'equipmentCode' | 'difficultyCode' | 'recordType'

export function emptyExerciseFilters(): ExerciseFilterState {
  return { categoryCode: '', equipmentCode: '', difficultyCode: '', recordType: '' }
}

export function countAdvancedFilters(state: ExerciseFilterState) {
  return [state.equipmentCode, state.difficultyCode, state.recordType].filter(Boolean).length
}

export function activeFilterChips(state: ExerciseFilterState, metadata: ExerciseFilterMetadata) {
  const definitions: Array<[AdvancedExerciseFilterKey, FilterOption[]]> = [
    ['equipmentCode', metadata.equipment],
    ['difficultyCode', metadata.difficulty],
    ['recordType', metadata.recordTypes]
  ]
  return definitions.flatMap(([key, options]) => {
    const value = state[key]
    const option = options.find((item) => item.value === value)
    return value ? [{ key, label: option?.label || value }] : []
  })
}

export function toExerciseQuery(state: ExerciseFilterState) {
  return Object.fromEntries(
    Object.entries(state).filter(([, value]) => Boolean(value))
  ) as Partial<ExerciseFilterState>
}
