export interface Exercise {
  id: number
  name: string
  category: string
  muscle: string
  equipment: string
  level: string
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
