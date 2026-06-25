<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/empty-state/index.vue'
import TrainingRecordCard from '@/components/training-record-card/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useThemeStore } from '@/stores/theme'
import { useTrainingStore } from '@/stores/training'

const trainingStore = useTrainingStore()
const themeStore = useThemeStore()
type HistoryFilterKey = 'week' | 'month' | 'lastMonth' | 'year' | 'all'

const historyList = computed(() => trainingStore.history)
const historyGroups = computed(() => {
  const groups: Array<{ date: string; items: typeof historyList.value }> = []
  for (const item of historyList.value) {
    const date = formatGroupDate(item.startedAt)
    const group = groups[groups.length - 1]
    if (group?.date === date) {
      group.items.push(item)
    } else {
      groups.push({ date, items: [item] })
    }
  }
  return groups
})
const activeFilter = ref<HistoryFilterKey>('month')
const filters: Array<{ key: HistoryFilterKey; label: string }> = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上个月' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' }
]
const activeFilterLabel = computed(
  () => filters.find((filter) => filter.key === activeFilter.value)?.label || '本月'
)
const subtitle = computed(() => `${activeFilterLabel.value} · 共 ${trainingStore.historyTotal} 次`)
const initialLoading = computed(() => trainingStore.loading && !historyList.value.length)
const footerText = computed(() => {
  if (trainingStore.loading && historyList.value.length) return '加载中...'
  if (historyList.value.length && !trainingStore.historyHasMore) return '没有更多记录了'
  if (historyList.value.length) return '上拉加载更多'
  return ''
})

onShow(async () => {
  const ok = await ensureFeatureAuth('训练记录')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  fetchHistory(true)
})

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: routes.home })
}

async function onDeleteHistory(id: number) {
  uni.showModal({
    title: '删除记录',
    content: '确定要删除这条训练记录吗？删除后无法恢复。',
    confirmText: '删除',
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (res.confirm) {
        try {
          await trainingStore.deleteTraining(id)
          uni.showToast({ title: '已删除', icon: 'none' })
        } catch (err) {
          uni.showToast({ title: '删除失败', icon: 'none' })
          console.error('[history] delete failed', err)
        }
      }
    }
  })
}

function openDetail(id: number) {
  uni.navigateTo({ url: `${routes.historyDetail}?id=${id}` })
}

function switchFilter(key: HistoryFilterKey) {
  if (activeFilter.value === key) return
  activeFilter.value = key
  fetchHistory(true)
}

function fetchHistory(reset = false) {
  const range = getFilterRange(activeFilter.value)
  trainingStore.fetchHistory({
    reset,
    startedFrom: range.startedFrom,
    startedTo: range.startedTo
  })
}

function retryFetch() {
  fetchHistory(true)
}

function loadMore() {
  if (trainingStore.loading || !trainingStore.historyHasMore) return
  fetchHistory(false)
}

function formatGroupDate(dateText: string) {
  const date = new Date(dateText)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return '今天'
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function getFilterRange(key: HistoryFilterKey): { startedFrom?: string; startedTo?: string } {
  const now = new Date()
  if (key === 'all') return {}
  if (key === 'week') {
    const start = new Date(now)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return toRange(start, end)
  }
  if (key === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return toRange(start, end)
  }
  if (key === 'year') {
    return toRange(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31))
  }
  return toRange(
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
  )
}

function toRange(start: Date, end: Date) {
  return {
    startedFrom: toDateString(start),
    startedTo: toDateString(end)
  }
}

function toDateString(date: Date) {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
</script>

<template>
  <scroll-view
    scroll-y
    class="page-scroll"
    :class="themeStore.themeClass"
    lower-threshold="120"
    @scrolltolower="loadMore"
  >
    <view class="page-shell history-page safe-bottom" :class="themeStore.themeClass">
      <view class="history-page__header">
        <view class="history-page__back btn-press" @tap="goBack">←</view>
        <view>
          <view class="history-page__title">训练记录</view>
          <view class="history-page__subtitle">{{ subtitle }}</view>
        </view>
      </view>

      <scroll-view scroll-x class="history-page__filters">
        <view class="history-page__filters-inner">
          <view
            v-for="filter in filters"
            :key="filter.key"
            class="history-page__filter btn-press"
            :class="{ 'history-page__filter--active': activeFilter === filter.key }"
            @tap="switchFilter(filter.key)"
          >
            {{ filter.label }}
          </view>
        </view>
      </scroll-view>

      <view v-if="initialLoading" class="history-page__state muted">加载中...</view>

      <view v-else-if="trainingStore.historyError" class="history-page__state">
        <EmptyState
          icon="⚠"
          title="训练记录加载失败"
          description="网络或服务暂时异常，可以稍后重试。"
        />
        <view class="gradient-fire history-page__retry btn-press" @tap="retryFetch">重新加载</view>
      </view>

      <view v-else-if="!historyList.length" class="history-page__state">
        <EmptyState
          icon="📅"
          title="当前范围没有训练记录"
          description="完成一次训练后，会在这里看到历史复盘。"
        />
      </view>

      <view v-else class="history-page__groups">
        <view v-for="group in historyGroups" :key="group.date" class="history-page__group">
          <view class="history-page__group-date">{{ group.date }}</view>
          <view class="history-page__list">
            <app-swipe-action
              v-for="item in group.items"
              :key="item.id"
              @delete="onDeleteHistory(item.id)"
            >
              <TrainingRecordCard
                :name="item.trainingName"
                :cover-url="item.coverUrl"
                :cover-record-type="item.coverRecordType"
                :meta="`${Math.round(item.durationSeconds / 60)} min · ${item.totalSetCount} 组 · ${Number(item.totalVolumeKg || 0).toFixed(0)} kg`"
                @tap="openDetail(item.id)"
              />
            </app-swipe-action>
          </view>
        </view>
      </view>

      <view v-if="footerText" class="history-page__footer muted">{{ footerText }}</view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.page-scroll {
  background: var(--app-bg);
}

.history-page {
  min-height: 100vh;
  color: var(--app-text);
  background: var(--app-bg);

  &__header {
    display: flex;
    align-items: center;
    gap: 20rpx;
    margin-bottom: 28rpx;
  }

  &__back {
    width: 72rpx;
    height: 72rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text);
    background: var(--app-surface);
    box-shadow: var(--app-shadow-card);
    font-size: 34rpx;
    font-weight: 800;
  }

  &__title {
    color: var(--app-text);
    font-size: 42rpx;
    font-weight: 900;
  }

  &__subtitle {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__filters {
    margin: 8rpx -32rpx 24rpx;
    white-space: nowrap;
  }

  &__filters-inner {
    display: inline-flex;
    gap: 12rpx;
    padding: 0 32rpx;
  }

  &__filter {
    min-width: 120rpx;
    min-height: 64rpx;
    padding: 0 24rpx;
    border-radius: 999rpx;
    border: 1rpx solid var(--app-border);
    background: var(--app-surface);
    color: var(--app-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 800;

    &--active {
      border-color: var(--app-accent);
      background: var(--app-accent);
      color: #fff;
      box-shadow: 0 8rpx 24rpx rgba(255, 100, 24, 0.2);
    }
  }

  &__state {
    padding-top: 80rpx;
  }

  &__retry {
    width: 240rpx;
    min-height: 76rpx;
    margin: 0 auto;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 26rpx;
    font-weight: 800;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__groups {
    display: grid;
    gap: 30rpx;
  }

  &__group-date {
    margin-bottom: 14rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    font-weight: 800;
  }

  &__footer {
    padding: 28rpx 0 8rpx;
    color: var(--app-text-muted);
    text-align: center;
    font-size: 24rpx;
  }
}
</style>
