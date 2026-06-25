<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import ShareCardSheet from '@/components/share-card-sheet/index.vue'
import { fetchWorkoutSharePreview, type SharePreviewResponse } from '@/api/share'
import {
  fetchTrainingReport,
  type TrainingPrResponse,
  type TrainingReportItemResponse,
  type TrainingReportResponse
} from '@/api/training'
import { routes } from '@/utils/navigation'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { formatSeconds } from '@/utils/format'
import { formatWeight } from '@/utils/unit'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore } from '@/stores/theme'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'

const workoutStore = useWorkoutStore()
const profileStore = useProfileStore()
const themeStore = useThemeStore()
const templateStore = useTemplateStore()
const savingTemplate = ref(false)
const report = ref<TrainingReportResponse | null>(null)
const loadingReport = ref(false)
const shareVisible = ref(false)
const shareLoading = ref(false)
const sharePreview = ref<SharePreviewResponse | null>(null)

const summary = computed(() => workoutStore.completedSummary)
const weightUnit = computed(() => profileStore.unit)
const displaySummary = computed(() => report.value || summary.value)
const reportItems = computed<TrainingReportItemResponse[]>(() => report.value?.items || [])
const durationText = computed(() => formatSeconds(displaySummary.value?.durationSeconds || 0))
const volumeText = computed(() =>
  displaySummary.value
    ? `${formatWeight(displaySummary.value.totalVolumeKg, weightUnit.value, 1)} ${weightUnit.value}`
    : '--'
)
const prs = computed<TrainingPrResponse[]>(() =>
  report.value ? reportItems.value.flatMap((item) => item.prs || []) : summary.value?.prs || []
)
const comparisons = computed(() =>
  report.value
    ? reportItems.value.map((item) => ({
        exerciseId: item.exerciseId,
        exerciseName: item.exerciseName,
        currentVolumeKg: item.totalVolumeKg,
        volumeDeltaKg: item.firstRecord ? null : item.volumeDeltaKg,
        currentMaxWeightKg: item.maxWeightKg,
        maxWeightDeltaKg: item.firstRecord ? null : item.maxWeightDeltaKg
      }))
    : summary.value?.comparisons || []
)
const highlightedComparisons = computed(() =>
  comparisons.value
    .filter((item) => item.volumeDeltaKg !== null || item.maxWeightDeltaKg !== null)
    .slice(0, 4)
)
const positiveComparisons = computed(() =>
  comparisons.value.filter(
    (item) => Number(item.volumeDeltaKg || 0) > 0 || Number(item.maxWeightDeltaKg || 0) > 0
  )
)
const bestVolumeComparison = computed(() =>
  comparisons.value
    .filter((item) => item.volumeDeltaKg !== null)
    .sort((a, b) => Number(b.volumeDeltaKg || 0) - Number(a.volumeDeltaKg || 0))[0]
)
const firstRecordCount = computed(() =>
  report.value ? reportItems.value.filter((item) => item.firstRecord).length : 0
)
const progressTitle = computed(() => {
  if (prs.value.length) return `新增 ${prs.value.length} 个 PR`
  if (positiveComparisons.value.length) return `${positiveComparisons.value.length} 个动作超过上次`
  if (firstRecordCount.value) return `${firstRecordCount.value} 个动作首次记录`
  return '训练已记录'
})
const progressSub = computed(() => {
  const best = bestVolumeComparison.value
  if (best?.volumeDeltaKg && best.volumeDeltaKg > 0) {
    return `${best.exerciseName} 容量比上次提升 ${deltaText(best.volumeDeltaKg)}。`
  }
  if (prs.value.length) return '本次训练刷新了个人最佳，后续可以在详情里复盘具体动作。'
  if (firstRecordCount.value) return '首次记录的动作会作为之后对比进步的基线。'
  return '保持连续记录，下一次训练后会有更清晰的对比。'
})
const sourceStatusText = computed(() => {
  if (summary.value?.activePlanId && summary.value?.activePlanDayId) return '已完成计划训练'
  if (summary.value?.activeTemplateId) return '模板训练已保存'
  return '自由训练已保存'
})
const hasPlanContext = computed(() =>
  Boolean(summary.value?.activePlanId && summary.value?.activePlanDayId)
)

onLoad((options) => {
  const rawId = typeof options?.id === 'string' ? Number(options.id) : 0
  if (Number.isFinite(rawId) && rawId > 0) {
    void loadReport(rawId)
  }
})

async function loadReport(trainingId: number) {
  loadingReport.value = true
  try {
    report.value = await fetchTrainingReport(trainingId)
  } catch (err) {
    uni.showToast({ title: '训练报告加载失败', icon: 'none' })
    console.error('[training] report fetch failed', err)
  } finally {
    loadingReport.value = false
  }
}

function goHome() {
  workoutStore.setCompletedSummary(null)
  uni.switchTab({ url: routes.home })
}

function goDetail() {
  const trainingId = displaySummary.value?.trainingId
  if (!trainingId) {
    goHome()
    return
  }

  uni.redirectTo({ url: `${routes.historyDetail}?id=${trainingId}` })
}

function goActivePlan() {
  const planId = summary.value?.activePlanId
  if (!planId) {
    goHome()
    return
  }
  uni.redirectTo({ url: `${routes.planDetail}?id=${planId}` })
}

async function saveAsTemplate() {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  const current = summary.value
  if (!current?.trainingId || savingTemplate.value) return
  const plannedItems = current.plannedItems || []
  if (!plannedItems.length) {
    uni.showToast({ title: '没有可保存的模板动作', icon: 'none' })
    return
  }

  savingTemplate.value = true
  try {
    await templateStore.saveFromPlan(`${current.trainingName} 模板`, plannedItems)
    uni.showToast({ title: '已保存到我的模板', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '保存模板失败', icon: 'none' })
    console.error('[template] save from plan failed', err)
  } finally {
    savingTemplate.value = false
  }
}

async function openShareCard() {
  const trainingId = displaySummary.value?.trainingId
  if (!trainingId) {
    uni.showToast({ title: '训练记录不存在', icon: 'none' })
    return
  }
  shareVisible.value = true
  shareLoading.value = true
  try {
    sharePreview.value = await fetchWorkoutSharePreview(trainingId)
  } catch (err) {
    shareVisible.value = false
    uni.showToast({ title: '分享预览生成失败', icon: 'none' })
    console.error('[share] workout preview failed', err)
  } finally {
    shareLoading.value = false
  }
}

function closeShareCard() {
  shareVisible.value = false
}

function copyShareText() {
  const text = sharePreview.value?.copyText
  if (!text) return
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制分享文案', icon: 'none' })
  })
}

function prTypeLabel(type: string) {
  switch (type) {
    case 'MAX_WEIGHT':
      return '最大重量'
    case 'MAX_REPS':
      return '最多次数'
    case 'MAX_VOLUME':
      return '最大容量'
    case 'MAX_DURATION':
      return '最长时长'
    default:
      return '个人最佳'
  }
}

function prValueText(type: string, value: number) {
  if (type === 'MAX_REPS') return `${value} 次`
  if (type === 'MAX_DURATION') return formatSeconds(value)
  return `${formatWeight(value, weightUnit.value, 1)} ${weightUnit.value}`
}

function deltaText(value?: number | null) {
  if (value === undefined || value === null) return '首次记录'
  if (value === 0) return '持平'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatWeight(value, weightUnit.value, 1)} ${weightUnit.value}`
}

function deltaClass(value?: number | null) {
  if (value === undefined || value === null || value === 0) return ''
  return value > 0 ? 'workout-summary__compare-value--up' : 'workout-summary__compare-value--down'
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell workout-summary safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="训练完成" subtitle="本次训练已保存" />

      <view class="workout-summary__hero">
        <view class="workout-summary__badge">{{ sourceStatusText }}</view>
        <view class="workout-summary__title">{{
          displaySummary?.trainingName || '训练已完成'
        }}</view>
        <view class="workout-summary__sub">
          {{ loadingReport ? '正在同步训练报告...' : '保持记录，才能看到真实进步。' }}
        </view>
      </view>

      <view class="workout-summary__grid">
        <view class="glass-card workout-summary__stat">
          <view class="workout-summary__label">时长</view>
          <view class="workout-summary__value">{{ durationText }}</view>
        </view>
        <view class="glass-card workout-summary__stat">
          <view class="workout-summary__label">总容量</view>
          <view class="workout-summary__value">{{ volumeText }}</view>
        </view>
        <view class="glass-card workout-summary__stat">
          <view class="workout-summary__label">动作</view>
          <view class="workout-summary__value"
            >{{ displaySummary?.totalExerciseCount || 0 }} 个</view
          >
        </view>
        <view class="glass-card workout-summary__stat">
          <view class="workout-summary__label">完成组</view>
          <view class="workout-summary__value">{{ displaySummary?.totalSetCount || 0 }} 组</view>
        </view>
      </view>

      <view class="glass-card workout-summary__insight">
        <view class="workout-summary__insight-label">本次收获</view>
        <view class="workout-summary__insight-title">{{ progressTitle }}</view>
        <view class="workout-summary__insight-copy">{{ progressSub }}</view>
      </view>

      <view v-if="highlightedComparisons.length" class="glass-card workout-summary__compare">
        <view class="workout-summary__note-title">相比上次</view>
        <view
          v-for="item in highlightedComparisons"
          :key="item.exerciseId"
          class="workout-summary__compare-row"
        >
          <view>
            <view class="workout-summary__compare-name">{{ item.exerciseName }}</view>
            <view class="workout-summary__compare-sub">容量变化</view>
          </view>
          <view class="workout-summary__compare-value" :class="deltaClass(item.volumeDeltaKg)">
            {{ deltaText(item.volumeDeltaKg) }}
          </view>
        </view>
      </view>

      <view v-if="prs.length" class="glass-card workout-summary__prs">
        <view class="workout-summary__note-title">本次新增 PR · {{ prs.length }}</view>
        <view
          v-for="item in prs.slice(0, 4)"
          :key="`${item.exerciseId}-${item.prType}`"
          class="workout-summary__pr"
        >
          <view>
            <view class="workout-summary__pr-name">{{ item.exerciseName }}</view>
            <view class="workout-summary__pr-type">{{ prTypeLabel(item.prType) }}</view>
          </view>
          <view class="workout-summary__pr-value">{{
            prValueText(item.prType, Number(item.value || 0))
          }}</view>
        </view>
      </view>

      <view class="workout-summary__actions">
        <view class="gradient-fire workout-summary__button btn-press" @tap="goHome">返回首页</view>
        <view class="glass-card workout-summary__button btn-press" @tap="goDetail">查看详情</view>
        <view class="glass-card workout-summary__button btn-press" @tap="openShareCard">
          生成分享卡
        </view>
        <view
          v-if="hasPlanContext"
          class="glass-card workout-summary__button btn-press"
          @tap="goActivePlan"
        >
          查看当前计划
        </view>
        <view class="glass-card workout-summary__button btn-press" @tap="saveAsTemplate">
          {{ savingTemplate ? '正在保存模板...' : '保存为我的模板' }}
        </view>
      </view>
    </view>
  </scroll-view>
  <ShareCardSheet
    :visible="shareVisible"
    :preview="sharePreview"
    :loading="shareLoading"
    @close="closeShareCard"
    @copy="copyShareText"
  />
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.workout-summary {
  &__hero {
    margin-top: 20rpx;
    padding: 44rpx 30rpx;
    border-radius: 42rpx;
    background:
      radial-gradient(circle at 20% 10%, rgba(255, 160, 60, 0.28), transparent 34%),
      linear-gradient(145deg, rgba(255, 80, 30, 0.2), rgba(20, 20, 28, 0.95));
    border: 1px solid rgba(255, 80, 30, 0.24);
  }

  &__badge {
    width: fit-content;
    padding: 10rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.14);
    color: #ffa03c;
    font-size: 22rpx;
    font-weight: 800;
  }

  &__title {
    margin-top: 24rpx;
    color: #fff;
    font-size: 44rpx;
    font-weight: 900;
  }

  &__sub {
    margin-top: 12rpx;
    color: rgba(245, 245, 250, 0.76);
    font-size: 24rpx;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16rpx;
    margin-top: 24rpx;
  }

  &__stat {
    padding: 26rpx;
  }

  &__label {
    color: #828296;
    font-size: 22rpx;
  }

  &__value {
    margin-top: 10rpx;
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 900;
  }

  &__note,
  &__insight {
    margin-top: 24rpx;
    padding: 28rpx;
  }

  &__insight {
    border-color: rgba(80, 220, 180, 0.18);
    background:
      linear-gradient(145deg, rgba(80, 220, 180, 0.08), rgba(255, 255, 255, 0.045));
  }

  &__insight-label {
    color: #3dd9a2;
    font-size: 21rpx;
    font-weight: 900;
  }

  &__insight-title {
    margin-top: 10rpx;
    color: #f5f5fa;
    font-size: 32rpx;
    font-weight: 900;
  }

  &__insight-copy {
    margin-top: 10rpx;
    color: #b8b8c8;
    font-size: 24rpx;
    line-height: 1.6;
  }

  &__prs {
    margin-top: 24rpx;
    padding: 28rpx;
  }

  &__compare {
    margin-top: 24rpx;
    padding: 28rpx;
  }

  &__compare-row {
    margin-top: 18rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
    padding: 18rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.05);
  }

  &__compare-name {
    color: #f5f5fa;
    font-size: 24rpx;
    font-weight: 800;
  }

  &__compare-sub {
    margin-top: 6rpx;
    color: #828296;
    font-size: 20rpx;
  }

  &__compare-value {
    color: #b8b8c8;
    font-size: 26rpx;
    font-weight: 900;

    &--up {
      color: #3dd9a2;
    }

    &--down {
      color: #ff6b4a;
    }
  }

  &__pr {
    margin-top: 18rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
    padding: 18rpx;
    border-radius: 22rpx;
    background: rgba(255, 80, 30, 0.08);
  }

  &__pr-name {
    color: #f5f5fa;
    font-size: 24rpx;
    font-weight: 800;
  }

  &__pr-type {
    margin-top: 6rpx;
    color: #828296;
    font-size: 20rpx;
  }

  &__pr-value {
    color: #ff7a32;
    font-size: 26rpx;
    font-weight: 900;
  }

  &__note-title {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 800;
  }

  &__note-copy {
    margin-top: 12rpx;
    color: #828296;
    font-size: 24rpx;
    line-height: 1.7;
  }

  &__actions {
    margin-top: 32rpx;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__button {
    min-height: 92rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 28rpx;
    font-weight: 800;
  }
}
</style>
