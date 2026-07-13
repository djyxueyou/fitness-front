<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import ShareCardSheet from '@/components/share-card-sheet/index.vue'
import { fetchWeeklyReviewSharePreview, type SharePreviewResponse } from '@/api/share'
import { fetchWeeklyReview, type WeeklyReviewResponse } from '@/api/weekly-review'
import { skipActiveTrainingPlanDay } from '@/api/plan'
import { routes } from '@/utils/navigation'
import { useThemeStore } from '@/stores/theme'
import { formatCompactWeight } from '@/utils/unit'

const themeStore = useThemeStore()
const review = ref<WeeklyReviewResponse | null>(null)
const loading = ref(false)
const shareVisible = ref(false)
const shareLoading = ref(false)
const sharePreview = ref<SharePreviewResponse | null>(null)

const totalVolume = computed(() =>
  review.value
    ? `${formatCompactWeight(Number(review.value.metrics.totalVolumeKg || 0), 'kg')} kg`
    : '--'
)
const totalDuration = computed(() =>
  review.value ? `${Math.round(review.value.metrics.totalDurationSeconds / 60)} min` : '--'
)

onLoad(() => {
  loadReview()
})

async function loadReview() {
  loading.value = true
  try {
    review.value = await fetchWeeklyReview()
  } catch (err) {
    console.error('[weekly-review] fetch failed', err)
    uni.showToast({ title: '周复盘加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goBack() {
  uni.navigateBack()
}

function handleNextAction() {
  const action = review.value?.nextAction
  if (!action) return
  if (action.type === 'RECOVER_OVERDUE') {
    openOverdueActions()
    return
  }
  if (action.type === 'START_FREE_WORKOUT') {
    uni.navigateTo({ url: routes.workoutActive })
    return
  }
  if (action.type === 'START_PLAN_DAY') {
    uni.switchTab({ url: routes.planIndex })
    return
  }
  uni.navigateTo({ url: routes.workoutCalendar })
}

function openOverdueActions() {
  uni.showActionSheet({
    itemList: ['去计划页处理', '跳过这个训练日', '查看训练日历'],
    success: async ({ tapIndex }) => {
      if (tapIndex === 0) {
        uni.switchTab({ url: routes.planIndex })
        return
      }
      if (tapIndex === 1) {
        await skipOverdueDay()
        return
      }
      uni.navigateTo({ url: routes.workoutCalendar })
    }
  })
}

async function skipOverdueDay() {
  const dayId = review.value?.nextAction.targetId
  if (!dayId) return
  try {
    await skipActiveTrainingPlanDay(dayId)
    uni.showToast({ title: '已跳过该训练日', icon: 'none' })
    await loadReview()
  } catch (err) {
    console.error('[weekly-review] skip overdue day failed', err)
    uni.showToast({ title: '操作失败，请稍后重试', icon: 'none' })
  }
}

async function openShareCard() {
  const weekStart = review.value?.weekStart
  if (!weekStart) return
  shareVisible.value = true
  shareLoading.value = true
  try {
    sharePreview.value = await fetchWeeklyReviewSharePreview(weekStart)
  } catch (err) {
    shareVisible.value = false
    uni.showToast({ title: '分享预览生成失败', icon: 'none' })
    console.error('[share] weekly preview failed', err)
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
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell weekly-review safe-bottom" :class="themeStore.themeClass">
      <view class="weekly-review__top">
        <view class="weekly-review__back btn-press" @tap="goBack">‹</view>
        <view>
          <view class="weekly-review__eyebrow">Weekly Review</view>
          <view class="weekly-review__title">本周复盘</view>
        </view>
        <view v-if="review" class="weekly-review__share btn-press" @tap="openShareCard">分享</view>
      </view>

      <view v-if="review" class="weekly-review__card weekly-review__hero">
        <view class="weekly-review__headline">{{ review.headline }}</view>
        <view class="weekly-review__copy">{{ review.conclusion }}</view>
        <view class="weekly-review__action btn-press" @tap="handleNextAction">
          <text>{{ review.nextAction.label }}</text>
          <text>→</text>
        </view>
      </view>

      <view v-if="review" class="weekly-review__metrics">
        <view class="weekly-review__metric">
          <text>训练次数</text>
          <strong>{{ review.metrics.sessionCount }} 次</strong>
        </view>
        <view class="weekly-review__metric">
          <text>总容量</text>
          <strong>{{ totalVolume }}</strong>
        </view>
        <view class="weekly-review__metric">
          <text>训练时长</text>
          <strong>{{ totalDuration }}</strong>
        </view>
      </view>

      <view v-if="review" class="weekly-review__card">
        <view class="weekly-review__section-title">7 日分布</view>
        <view class="weekly-review__days">
          <view v-for="day in review.days" :key="day.date" class="weekly-review__day">
            <view
              class="weekly-review__dot"
              :class="{ 'weekly-review__dot--trained': day.sessionCount > 0 }"
            >
              <text v-if="day.sessionCount > 0">✓</text>
            </view>
            <view class="weekly-review__day-label">周{{ day.dayOfWeek }}</view>
          </view>
        </view>
      </view>

      <view v-if="review?.attentionItems.length" class="weekly-review__card">
        <view class="weekly-review__section-title">需要关注</view>
        <view v-for="item in review.attentionItems" :key="item.type" class="weekly-review__item">
          <view class="weekly-review__item-title">{{ item.title }}</view>
          <view class="weekly-review__item-copy">{{ item.description }}</view>
        </view>
      </view>

      <view v-if="review?.highlights.length" class="weekly-review__card">
        <view class="weekly-review__section-title">本周亮点</view>
        <view v-for="item in review.highlights" :key="item.type" class="weekly-review__item">
          <view class="weekly-review__item-title">{{ item.title }}</view>
          <view class="weekly-review__item-copy">{{ item.description }}</view>
        </view>
      </view>

      <view v-if="loading" class="weekly-review__loading">加载中...</view>
    </view>
  </scroll-view>
  <ShareCardSheet
    :visible="shareVisible"
    :preview="sharePreview"
    :loading="shareLoading"
    @close="closeShareCard"
    @copy="copyShareText"
  />
</template>

<style lang="scss" scoped>
.weekly-review {
  min-height: 100vh;
  padding: 32rpx;
  background:
    radial-gradient(circle at 80% 0%, rgba(255, 108, 38, 0.12), transparent 34%), var(--app-bg);
  color: var(--app-text);
}

.weekly-review__top {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 28rpx;
}

.weekly-review__top > view:nth-child(2) {
  flex: 1;
}

.weekly-review__back {
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-surface);
  box-shadow: var(--app-shadow-card);
  font-size: 48rpx;
  font-weight: 800;
}

.weekly-review__eyebrow {
  color: var(--app-text-muted);
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.weekly-review__title {
  margin-top: 6rpx;
  font-size: 48rpx;
  font-weight: 900;
}

.weekly-review__share {
  padding: 14rpx 22rpx;
  border-radius: 999rpx;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  font-size: 24rpx;
  font-weight: 900;
}

.weekly-review__card {
  padding: 28rpx;
  border-radius: 28rpx;
  background: var(--app-surface);
  border: 1rpx solid var(--app-border);
  box-shadow: var(--app-shadow-card);
  margin-bottom: 24rpx;
}

.weekly-review__hero {
  background: linear-gradient(135deg, #fffaf6, #fff2e8);
  border-color: rgba(255, 108, 38, 0.18);
}

.weekly-review__headline {
  font-size: 36rpx;
  font-weight: 900;
}

.weekly-review__copy,
.weekly-review__item-copy {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 26rpx;
  line-height: 1.6;
}

.weekly-review__action {
  margin-top: 28rpx;
  height: 88rpx;
  border-radius: 28rpx;
  padding: 0 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  background: linear-gradient(135deg, var(--app-accent), var(--app-accent-strong, #ff7a00));
  font-size: 28rpx;
  font-weight: 900;
  box-shadow: 0 18rpx 34rpx rgba(255, 107, 31, 0.24);
}

.weekly-review__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.weekly-review__metric {
  padding: 22rpx 18rpx;
  border-radius: 24rpx;
  background: var(--app-surface);
  border: 1rpx solid var(--app-border);
  box-shadow: var(--app-shadow-card);
}

.weekly-review__metric text {
  display: block;
  color: var(--app-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

.weekly-review__metric strong {
  display: block;
  margin-top: 10rpx;
  font-size: 30rpx;
  font-weight: 900;
}

.weekly-review__section-title {
  font-size: 30rpx;
  font-weight: 900;
  margin-bottom: 22rpx;
}

.weekly-review__days {
  display: flex;
  justify-content: space-between;
}

.weekly-review__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.weekly-review__dot {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f6fa;
  border: 2rpx solid var(--app-border);
  color: #fff;
  font-size: 24rpx;
  font-weight: 900;
}

.weekly-review__dot--trained {
  background: #64c587;
  border-color: #64c587;
}

.weekly-review__day-label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

.weekly-review__item + .weekly-review__item {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--app-border);
}

.weekly-review__item-title {
  font-size: 28rpx;
  font-weight: 900;
}

.weekly-review__loading {
  margin-top: 40rpx;
  text-align: center;
  color: var(--app-text-muted);
}
</style>
