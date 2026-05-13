import { getCachedUserProfile } from '@/api/user'

export type WeightUnit = 'kg' | 'lb'

const LB_PER_KG = 2.20462

export function resolveWeightUnit(): WeightUnit {
  const unit = getCachedUserProfile()?.weightUnit
  return unit === 'lb' ? 'lb' : 'kg'
}

export function convertKgToUnit(valueKg: number, unit: WeightUnit): number {
  if (unit === 'lb') {
    return valueKg * LB_PER_KG
  }
  return valueKg
}

export function convertUnitToKg(value: number, unit: WeightUnit): number {
  if (unit === 'lb') {
    return value / LB_PER_KG
  }
  return value
}

export function formatWeight(valueKg: number, unit: WeightUnit, digits = 1): string {
  const converted = convertKgToUnit(Number(valueKg || 0), unit)
  return converted.toFixed(digits)
}

export function formatCompactWeight(valueKg: number, unit: WeightUnit, digits = 1): string {
  const converted = convertKgToUnit(Number(valueKg || 0), unit)
  const absValue = Math.abs(converted)
  if (absValue < 10000) {
    return converted.toLocaleString('zh-CN', {
      maximumFractionDigits: 0
    })
  }
  return `${(converted / 10000).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}万`
}
