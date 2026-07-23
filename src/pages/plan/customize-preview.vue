<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import AppActionSheet from '@/components/app-action-sheet/index.vue'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import RestSecondsSheet from '@/components/rest-seconds-sheet/index.vue'
import ExerciseThumbnail from '@/components/exercise-thumbnail/index.vue'
import { isStalePlanDetailError, usePlanStore } from '@/stores/plan'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { planExerciseThumbnail } from '@/utils/plan-exercise-thumbnail'
import { runSystemPlanActivation } from '@/utils/system-plan-activation'
import type {
  SystemPlanDetailResponse,
  SystemPlanCustomizationRequest,
  SystemPlanPreviewResponse
} from '@/api/plan'

const planStore = usePlanStore()
const themeStore = useThemeStore()
const planId = ref<number | null>(null)
const intro = ref<SystemPlanDetailResponse | null>(null)
const preview = ref<SystemPlanPreviewResponse | null>(null)
const loading = ref(false)
const activating = ref(false)
const activationRequestId = ref('')
const replacementConfirmVisible = ref(false)
const selectedWeek = ref(1)
const payload = ref<SystemPlanCustomizationRequest>({
  weeklyFrequency: 3,
  unavailableBodyParts: ['NONE'],
  equipment: 'GYM',
  durationMinutes: 35,
  restSecondsByExerciseId: {}
})
type PreviewItem = SystemPlanPreviewResponse['days'][number]['items'][number]
const restEditorItem = ref<{ item: PreviewItem; dayOfWeek: number } | null>(null)
const replacementConfirmItems = [
  {
    key: 'confirm-replacement',
    label: '确认替换',
    description: '使用新计划继续安排训练，历史记录不会被删除',
    primary: true
  }
]
let resolveReplacementConfirmation: ((confirmed: boolean) => void) | null = null

const previewWeeks = computed(() => {
  const total = intro.value?.cycleWeeks || 1
  return Array.from({ length: total }, (_, index) => index + 1)
})
const visibleDays = computed(() => {
  if (!preview.value) return []
  return preview.value.days.filter((day) => day.weekIndex === selectedWeek.value)
})
const summaryText = computed(() => {
  if (!intro.value) return ''
  return `${intro.value.cycleWeeks} 周 · 每周 ${payload.value.weeklyFrequency} 练 · ${payload.value.durationMinutes} min`
})

onLoad((options) => {
  const id = Number(options?.id)
  planId.value = Number.isFinite(id) && id > 0 ? id : null
  payload.value = {
    weeklyFrequency: Number(options?.weeklyFrequency) || 3,
    unavailableBodyParts: String(options?.unavailableBodyParts || 'NONE')
      .split(',')
      .filter(Boolean),
    equipment: normalizeEquipment(String(options?.equipment || 'GYM')),
    durationMinutes: normalizeDuration(Number(options?.durationMinutes)),
    restSecondsByExerciseId: {}
  }
  activationRequestId.value = `plan-activate-${Date.now()}-${Math.random().toString(16).slice(2)}`
})

onShow(async () => {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await loadPreview()
})

onUnload(() => settleReplacementConfirmation(false))

async function loadPreview() {
  if (!planId.value || loading.value || preview.value) return
  loading.value = true
  try {
    const [introResult, previewResult] = await Promise.all([
      planStore.getSystemPlanDetail(planId.value),
      planStore.previewSystem(planId.value, payload.value)
    ])
    intro.value = introResult
    preview.value = previewResult
  } catch (err) {
    preview.value = null
    uni.showToast({ title: '预览生成失败', icon: 'none' })
    console.error('[plan] customize preview failed', err)
  } finally {
    loading.value = false
  }
}

async function activate() {
  if (!planId.value || activating.value) return
  activating.value = true
  try {
    const activated = await runSystemPlanActivation(activateWithReplacement, confirmPlanReplacement)
    if (!activated) return
    uni.showToast({ title: '已启用计划', icon: 'none' })
    uni.reLaunch({ url: routes.planActive })
  } catch (err) {
    if (isStalePlanDetailError(err)) return
    uni.showToast({ title: '启用失败', icon: 'none' })
    console.error('[plan] activate system plan failed', err)
  } finally {
    activating.value = false
  }
}

function activateWithReplacement(replaceCurrent: boolean) {
  return planStore.activateSystem(planId.value!, {
    ...payload.value,
    clientRequestId: activationRequestId.value,
    replaceCurrent
  })
}

function confirmPlanReplacement() {
  return new Promise<boolean>((resolve) => {
    resolveReplacementConfirmation = resolve
    replacementConfirmVisible.value = true
  })
}

function settleReplacementConfirmation(confirmed: boolean) {
  replacementConfirmVisible.value = false
  const resolve = resolveReplacementConfirmation
  resolveReplacementConfirmation = null
  resolve?.(confirmed)
}

function handleReplacementConfirmation(item: { key: string }) {
  if (item.key !== 'confirm-replacement') return
  settleReplacementConfirmation(true)
}

function regenerate() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.redirectTo({
    url: planId.value ? `${routes.planCustomize}?id=${planId.value}` : routes.planIndex
  })
}

function selectWeek(week: number) {
  selectedWeek.value = week
}

function weekdayLabel(value: number) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][value % 7] || `周${value}`
}

function itemTarget(item: SystemPlanPreviewResponse['days'][number]['items'][number]) {
  const sets = item.targetSets || 1
  if (item.targetDurationSeconds) return `${sets} 组 · ${item.targetDurationSeconds} 秒`
  if (item.targetWeightKg != null && item.targetReps) {
    return `${sets} 组 · ${item.targetWeightKg}kg × ${item.targetReps} 次`
  }
  if (item.targetReps) return `${sets} 组 · ${item.targetReps} 次`
  return `${sets} 组`
}

function chooseItemRest(dayOfWeek: number, item: PreviewItem) {
  restEditorItem.value = { item, dayOfWeek }
}

function confirmItemRest(result: { restSeconds: number; scope: 'CURRENT' | 'ALL_MATCHING' }) {
  const editor = restEditorItem.value
  if (!editor || !preview.value) return
  const { item, dayOfWeek } = editor
  if (result.scope === 'ALL_MATCHING') {
    payload.value.restSecondsByExerciseId = {
      ...(payload.value.restSecondsByExerciseId || {}),
      [item.exerciseId]: result.restSeconds
    }
  } else {
    payload.value.restSecondsByOccurrence = {
      ...(payload.value.restSecondsByOccurrence || {}),
      [`${dayOfWeek}:${item.sortOrder}`]: result.restSeconds
    }
  }
  preview.value.days.forEach((day) => {
    day.items.forEach((target) => {
      if (
        (result.scope === 'ALL_MATCHING' && target.exerciseId === item.exerciseId) ||
        (result.scope === 'CURRENT' &&
          day.dayOfWeek === dayOfWeek &&
          target.sortOrder === item.sortOrder)
      )
        target.plannedRestSeconds = result.restSeconds
    })
  })
  restEditorItem.value = null
}

function normalizeEquipment(value: string): SystemPlanCustomizationRequest['equipment'] {
  if (['GYM', 'DUMBBELL', 'BODYWEIGHT'].includes(value)) {
    return value as SystemPlanCustomizationRequest['equipment']
  }
  return 'GYM'
}

function normalizeDuration(value: number): 20 | 35 | 50 {
  if (value === 20 || value === 50) return value
  return 35
}

function goBack() {
  regenerate()
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view
      class="page-shell secondary-page customize-preview safe-bottom"
      :class="themeStore.themeClass"
    >
      <AppHeader
        title="安排预览"
        :subtitle="summaryText || '查看动作后启用'"
        show-back
        @back="goBack"
      />

      <EmptyState
        v-if="!loading && !preview"
        icon="!"
        title="预览不可用"
        description="可以返回重新选择计划条件。"
      />

      <template v-else>
        <view class="customize-preview__hero">
          <view>
            <view class="customize-preview__eyebrow">已生成安排</view>
            <view class="customize-preview__title">{{ preview?.displayName || intro?.name }}</view>
            <view class="customize-preview__sub">
              {{ preview?.replacementSummary || summaryText }}
            </view>
          </view>
          <view class="customize-preview__change btn-press" @tap="regenerate">调整设置</view>
        </view>

        <view v-if="loading" class="customize-preview__state">正在生成动作安排...</view>
        <template v-else-if="preview">
          <scroll-view scroll-x class="customize-preview__week-scroll" :show-scrollbar="false">
            <view class="customize-preview__week-tabs">
              <view
                v-for="week in previewWeeks"
                :key="week"
                class="customize-preview__week-tab btn-press"
                :class="{ 'customize-preview__week-tab--active': selectedWeek === week }"
                @tap="selectWeek(week)"
              >
                第 {{ week }} 周
              </view>
            </view>
          </scroll-view>

          <view class="customize-preview__days">
            <view
              v-for="day in visibleDays"
              :key="`${day.weekIndex}-${day.dayOfWeek}`"
              class="customize-preview__day"
            >
              <view class="customize-preview__day-head">
                <view>
                  <view class="customize-preview__day-schedule">
                    {{ weekdayLabel(day.dayOfWeek) }} ·
                    {{ day.phaseLabel || `第 ${day.weekIndex} 周` }}
                  </view>
                  <view class="customize-preview__day-title">{{ day.title }}</view>
                  <view class="customize-preview__day-sub">
                    {{ day.items.length }} 个动作 · 预计 {{ payload.durationMinutes }} 分钟
                  </view>
                </view>
              </view>
              <view
                v-for="item in day.items"
                :key="`${day.dayOfWeek}-${item.sortOrder}`"
                class="customize-preview__item"
              >
                <ExerciseThumbnail
                  :name="item.exerciseName"
                  :record-type="planExerciseThumbnail(item).recordType"
                  :url="planExerciseThumbnail(item).thumbnailUrl"
                />
                <view class="customize-preview__item-copy">
                  <view class="customize-preview__item-name">{{ item.exerciseName }}</view>
                  <view class="customize-preview__item-summary">{{ itemTarget(item) }}</view>
                  <view v-if="item.replacementReason" class="customize-preview__item-reason">
                    {{ item.replacementReason }}
                  </view>
                </view>
                <view
                  class="customize-preview__rest-pill btn-press"
                  @tap="chooseItemRest(day.dayOfWeek, item)"
                >
                  休息 {{ item.plannedRestSeconds ?? 60 }} 秒 ›
                </view>
              </view>
            </view>
          </view>

          <view v-if="preview.warnings.length" class="customize-preview__warnings">
            <view
              v-for="warning in preview.warnings"
              :key="warning"
              class="customize-preview__warning"
            >
              {{ warning }}
            </view>
          </view>

          <view class="customize-preview__footer">
            <PrimaryButton class="customize-preview__primary" :loading="activating" @tap="activate">
              启用计划
            </PrimaryButton>
          </view>
          <RestSecondsSheet
            :visible="restEditorItem !== null"
            :exercise-name="restEditorItem?.item.exerciseName || ''"
            :value="restEditorItem?.item.plannedRestSeconds ?? 60"
            :allow-all-matching="true"
            default-scope="ALL_MATCHING"
            @close="restEditorItem = null"
            @confirm="confirmItemRest"
          />
        </template>
      </template>
    </view>
  </scroll-view>
  <AppActionSheet
    :class="themeStore.themeClass"
    :visible="replacementConfirmVisible"
    title="替换当前计划？"
    subtitle="启用新计划后，当前计划会停止；已完成的训练记录和历史进度会保留。"
    cancel-text="暂不替换"
    :items="replacementConfirmItems"
    @close="settleReplacementConfirmation(false)"
    @select="handleReplacementConfirmation"
  />
</template>

<style lang="scss" scoped>
.customize-preview {
  &__hero,
  &__day {
    border: 1rpx solid var(--app-border);
    border-radius: 30rpx;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 10rpx 28rpx rgba(31, 49, 72, 0.06);
  }

  &__hero {
    padding: 26rpx;
    display: flex;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__eyebrow,
  &__sub,
  &__day-schedule,
  &__day-sub,
  &__item-reason,
  &__state,
  &__warning {
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__title {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 950;
  }

  &__sub {
    margin-top: 8rpx;
  }

  &__change,
  &__secondary {
    flex-shrink: 0;
    min-height: 58rpx;
    padding: 0 18rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__state {
    margin-top: 22rpx;
    padding: 30rpx;
    border-radius: 24rpx;
    background: var(--app-surface);
    text-align: center;
  }

  &__week-scroll {
    margin-top: 24rpx;
    white-space: nowrap;
  }

  &__week-tabs {
    display: inline-flex;
    gap: 12rpx;
    padding-bottom: 2rpx;
  }

  &__week-tab {
    min-width: 116rpx;
    min-height: 56rpx;
    padding: 0 20rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.78);
    color: var(--app-text-muted);
    font-size: 22rpx;
    font-weight: 800;
  }

  &__week-tab--active {
    border-color: transparent;
    background: var(--app-accent);
    color: #fff;
    box-shadow: 0 10rpx 24rpx rgba(255, 100, 24, 0.16);
  }

  &__days {
    margin-top: 18rpx;
    display: grid;
    gap: 16rpx;
  }

  &__day {
    padding: 22rpx;
  }

  &__day-title {
    margin-top: 6rpx;
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 950;
    line-height: 1.35;
  }

  &__day-sub {
    margin-top: 6rpx;
  }

  &__item {
    min-height: 112rpx;
    padding: 14rpx 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
    border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  }

  &__item-copy {
    flex: 1;
    min-width: 0;
  }

  &__item-name {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 800;
  }

  &__item-summary {
    margin-top: 6rpx;
    color: var(--app-text-secondary);
    font-size: 21rpx;
    font-weight: 750;
  }

  &__rest-pill {
    flex-shrink: 0;
    min-height: 56rpx;
    padding: 0 16rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border: 1rpx solid rgba(255, 91, 31, 0.24);
    font-size: 20rpx;
    font-weight: 900;
  }

  &__warnings {
    margin-top: 18rpx;
  }

  &__warning {
    margin-top: 8rpx;
  }

  &__footer {
    position: sticky;
    bottom: 0;
    display: grid;
    grid-template-columns: 1fr;
    padding-top: 20rpx;
    background: linear-gradient(180deg, rgba(243, 246, 249, 0), var(--app-bg) 28%);
  }

  &__secondary {
    min-height: 76rpx;
  }

  &__primary {
    margin: 0;
  }
}
</style>
