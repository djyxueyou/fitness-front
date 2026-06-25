export interface WarmupCandidate {
  weight: number
  reps: number
}

interface BuildWarmupOptions {
  targetWeight: number
  targetReps: number
  weightStep: number
}

function roundToStep(value: number, step: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (!Number.isFinite(step) || step <= 0) return Number(value.toFixed(2))
  return Number((Math.round(value / step) * step).toFixed(2))
}

export function buildWarmupCandidates(options: BuildWarmupOptions): WarmupCandidate[] {
  const targetWeight = Number(options.targetWeight || 0)
  const targetReps = Math.max(1, Math.round(Number(options.targetReps || 1)))
  const weightStep = Number(options.weightStep || 2.5)

  if (targetWeight <= 0) return []

  const rules =
    targetWeight < 30
      ? [{ ratio: 0.5, reps: 10 }]
      : targetWeight < 60
        ? [
            { ratio: 0.5, reps: 8 },
            { ratio: 0.75, reps: 5 }
          ]
        : targetWeight < 100
          ? [
              { ratio: 0.4, reps: 8 },
              { ratio: 0.6, reps: 5 },
              { ratio: 0.8, reps: 3 }
            ]
          : [
              { ratio: 0.4, reps: 8 },
              { ratio: 0.6, reps: 5 },
              { ratio: 0.75, reps: 3 },
              { ratio: 0.9, reps: 2 }
            ]

  return rules
    .map((rule) => ({
      weight: roundToStep(targetWeight * rule.ratio, weightStep),
      reps: Math.min(targetReps, rule.reps)
    }))
    .filter((item) => item.weight > 0 && item.weight < targetWeight && item.reps > 0)
}
