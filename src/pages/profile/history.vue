<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useTrainingStore } from '@/stores/training'

const trainingStore = useTrainingStore()
type HistoryFilterKey = 'week' | 'month' | 'lastMonth' | 'year' | 'all'

const historyList = computed(() => trainingStore.history)
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
  uni.navigateBack()
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

function formatDate(dateText: string) {
  const date = new Date(dateText)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function getFilterRange(key: HistoryFilterKey) {
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
  <scroll-view scroll-y class="page-scroll" @scrolltolower="loadMore">
    <view class="page-shell safe-bottom">
      <AppHeader title="历史记录" :subtitle="subtitle" show-back @back="goBack" />

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

      <view v-else class="history-page__list">
        <app-swipe-action
          v-for="item in historyList"
          :key="item.id"
          @delete="onDeleteHistory(item.id)"
        >
          <view class="glass-card history-page__item btn-press" @tap="openDetail(item.id)">
            <view class="history-page__icon">🏋</view>
            <view class="history-page__body">
              <view class="history-page__name">{{ item.trainingName }}</view>
              <view class="history-page__meta">
                {{ formatDate(item.startedAt) }} · {{ Math.round(item.durationSeconds / 60) }} min
              </view>
            </view>
            <view class="history-page__arrow">›</view>
          </view>
        </app-swipe-action>
      </view>

      <view v-if="footerText" class="history-page__footer muted">{{ footerText }}</view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.history-page {
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
    background: rgba(255, 255, 255, 0.06);
    color: #b8b8c8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 800;

    &--active {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
      box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.22);
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

  &__item {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 24rpx;
  }

  &__icon {
    width: 68rpx;
    height: 68rpx;
    border-radius: 20rpx;
    background: rgba(255, 80, 30, 0.16);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__body {
    flex: 1;
  }

  &__name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__meta {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__arrow {
    color: #828296;
    font-size: 32rpx;
  }

  &__footer {
    padding: 28rpx 0 8rpx;
    text-align: center;
    font-size: 24rpx;
  }
}
</style>
