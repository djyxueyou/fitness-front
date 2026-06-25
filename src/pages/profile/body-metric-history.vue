<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import {
  fetchBodyMetricHistory,
  type BodyMetricHistoryDayResponse,
  type BodyMetricType
} from '@/api/user'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

type MetricFilter = {
  label: string
  value: BodyMetricType | ''
}

const filters: MetricFilter[] = [
  { label: '全部', value: '' },
  { label: '体重', value: 'WEIGHT' },
  { label: '体脂率', value: 'BODY_FAT' },
  { label: '腰围', value: 'WAIST' },
  { label: '胸围', value: 'CHEST' },
  { label: '臀围', value: 'HIP' },
  { label: '上臂围', value: 'ARM' },
  { label: '大腿围', value: 'THIGH' },
  { label: '静息心率', value: 'RESTING_HEART_RATE' }
]

const loading = ref(false)
const loadingMore = ref(false)
const selectedMetricType = ref<BodyMetricType | ''>('')
const history = ref<BodyMetricHistoryDayResponse[]>([])
const nextCursor = ref<string | undefined>()
const hasMore = ref(false)
const statusText = computed(() => {
  if (loading.value) return '加载中'
  if (!history.value.length) return '暂无记录'
  return hasMore.value ? '可加载更多' : '已全部显示'
})

onShow(async () => {
  const ok = await ensureFeatureAuth('身体指标历史')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await refreshHistory()
})

function goBack() {
  uni.navigateBack()
}

async function refreshHistory() {
  loading.value = true
  try {
    const page = await fetchBodyMetricHistory({
      limit: 30,
      metricType: selectedMetricType.value || undefined
    })
    history.value = page.items
    nextCursor.value = page.nextCursor
    hasMore.value = page.hasMore
  } catch (err) {
    uni.showToast({ title: '历史记录加载失败', icon: 'none' })
    console.error('[body-metric-history] load failed', err)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const page = await fetchBodyMetricHistory({
      limit: 30,
      cursor: nextCursor.value,
      metricType: selectedMetricType.value || undefined
    })
    history.value = history.value.concat(page.items)
    nextCursor.value = page.nextCursor
    hasMore.value = page.hasMore
  } catch (err) {
    uni.showToast({ title: '加载更多失败', icon: 'none' })
    console.error('[body-metric-history] load more failed', err)
  } finally {
    loadingMore.value = false
  }
}

function selectFilter(value: BodyMetricType | '') {
  if (selectedMetricType.value === value || loading.value) return
  selectedMetricType.value = value
  refreshHistory()
}

function formatHistoryMetric(metric: BodyMetricHistoryDayResponse['metrics'][number]) {
  return `${metric.label || metric.metricType} ${Number(metric.value)}${metric.unit}`
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell body-history safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="身体指标历史" subtitle="查看身体数据变化记录" show-back @back="goBack" />

      <view class="body-history__hero surface-card">
        <view>
          <view class="eyebrow">History</view>
          <view class="body-history__hero-title">长期指标记录</view>
          <view class="body-history__hero-sub">按日期倒序展示，支持单项指标筛选。</view>
        </view>
        <view class="status-pill">{{ statusText }}</view>
      </view>

      <scroll-view scroll-x class="body-history__filters" show-scrollbar="false">
        <view class="body-history__filter-row">
          <button
            v-for="filter in filters"
            :key="filter.value || 'ALL'"
            class="body-history__filter btn-press"
            :class="{ 'body-history__filter--active': selectedMetricType === filter.value }"
            @tap="selectFilter(filter.value)"
          >
            {{ filter.label }}
          </button>
        </view>
      </scroll-view>

      <view class="body-history__section surface-card">
        <view class="section-heading">
          <view>
            <view class="section-label">RECORDS</view>
            <view class="section-title">历史记录</view>
          </view>
          <view class="status-pill">{{ history.length }} 天</view>
        </view>

        <view v-if="history.length" class="body-history__list">
          <view v-for="day in history" :key="day.measuredAt" class="body-history__day">
            <view class="body-history__date">{{ day.measuredAt }}</view>
            <view class="body-history__chips">
              <view
                v-for="metric in day.metrics"
                :key="`${day.measuredAt}-${metric.metricType}`"
                class="body-history__chip"
              >
                {{ formatHistoryMetric(metric) }}
              </view>
            </view>
          </view>
        </view>
        <view v-else class="body-history__empty">
          {{ loading ? '正在加载历史记录...' : '暂无历史记录，保存身体指标后会在这里展示。' }}
        </view>

        <button
          v-if="history.length"
          class="body-history__load-more btn-press"
          :disabled="loadingMore || !hasMore"
          @tap="loadMore"
        >
          {{ loadingMore ? '加载中...' : hasMore ? '加载更多' : '已显示全部记录' }}
        </button>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.body-history {
  &__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18rpx;
    padding: 26rpx;
  }

  &__hero-title {
    margin-top: 6rpx;
    color: var(--app-text);
    font-size: 38rpx;
    font-weight: 900;
    line-height: 1.2;
  }

  &__hero-sub {
    margin-top: 10rpx;
    color: var(--app-text-muted);
    font-size: 23rpx;
    line-height: 1.45;
  }

  &__filters {
    margin-top: 24rpx;
    width: 100%;
    white-space: nowrap;
  }

  &__filter-row {
    display: inline-flex;
    gap: 14rpx;
    padding-right: 10rpx;
  }

  &__filter {
    min-height: 64rpx;
    margin: 0;
    padding: 0 24rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-secondary);
    background: var(--app-surface);
    font-size: 24rpx;
    font-weight: 800;

    &::after {
      border: 0;
    }

    &--active {
      color: var(--app-accent);
      background: var(--app-accent-soft);
      border-color: rgba(255, 80, 30, 0.58);
    }
  }

  &__section {
    margin-top: 24rpx;
    padding: 26rpx;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__day {
    padding: 20rpx;
    border-radius: 22rpx;
    background: var(--app-bg);
    border: 1rpx solid var(--app-border);
  }

  &__date {
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
  }

  &__chips {
    margin-top: 14rpx;
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
  }

  &__chip {
    min-height: 46rpx;
    padding: 0 16rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    color: var(--app-text-secondary);
    background: var(--app-surface);
    border: 1rpx solid var(--app-border);
    font-size: 21rpx;
    font-weight: 800;
    line-height: 1.2;
  }

  &__empty {
    padding: 24rpx;
    border-radius: 22rpx;
    color: var(--app-text-muted);
    background: var(--app-bg);
    font-size: 23rpx;
    line-height: 1.5;
  }

  &__load-more {
    min-height: 76rpx;
    margin: 22rpx 0 0;
    padding: 0 20rpx;
    border: 0;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    font-size: 24rpx;
    font-weight: 900;

    &::after {
      border: 0;
    }

    &[disabled] {
      color: var(--app-text-muted);
      background: var(--app-bg);
    }
  }
}
</style>
