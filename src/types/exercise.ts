export interface Exercise {
  id: number
  name: string
  category: string
  muscle: string
  primaryMuscleCode?: string
  primaryMuscleName?: string
  secondaryMuscles?: string[]
  equipment: string
  equipmentCode?: string
  equipmentName?: string
  equipmentDetail?: string
  level: string
  difficultyCode?: string
  difficultyName?: string
  recordType?: string
  exerciseType?: string
  thumbnailUrl?: string
  isVariant?: number
  variantOfExerciseId?: number
  progressionLevel?: number
  favorited?: boolean
}

export interface ExerciseDetail extends Exercise {
  secondaryMuscles?: string[]
  instructionText?: string
  formCuesText?: string
  mediaUrl?: string
  mediaSizeBytes?: number
  mediaWidth?: number
  mediaHeight?: number
  alternativeExerciseIds?: number[]
  planningTagsJson?: string
  sourceReferenceUrl?: string
  contentReviewStatus?: string
}

export interface ExerciseRecord {
  maxWeight: string
  bestSet: string
}
