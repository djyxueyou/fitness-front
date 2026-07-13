export interface PlanExerciseThumbnailInput {
  recordType?: string
  thumbnailUrl?: string
}

export function planExerciseThumbnail(item: PlanExerciseThumbnailInput) {
  return {
    recordType: item.recordType,
    thumbnailUrl: item.thumbnailUrl
  }
}
