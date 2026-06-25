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
  favorited?: boolean
}

export interface ExerciseDetail extends Exercise {
  secondaryMuscles?: string[]
  instructionText?: string
  commonMistakesText?: string
  checklistText?: string
  mediaUrl?: string
  mediaSizeBytes?: number
  mediaWidth?: number
  mediaHeight?: number
  alternativeExerciseIds?: number[]
}

export interface ExerciseRecord {
  maxWeight: string
  bestSet: string
}
