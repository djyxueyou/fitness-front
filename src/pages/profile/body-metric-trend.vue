<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import MetricTrendChart from '@/components/metric-trend-chart/index.vue'
import { fetchBodyMetricTrend, type BodyMetricTrendPoint, type BodyMetricType } from '@/api/user'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'

type MetricOption = {
  type: BodyMetricType
  label: string
}

const metricOptions: MetricOption[] = [
  { type: 'WEIGHT', label: '体重' },
  { type: 'BODY_FAT', label: '体脂率' },
  { type: 'WAIST', label: '腰围' },
  { type: 'CHEST', label: '胸围' },
  { type: 'HIP', label: '臀围' },
  { type: 'ARM', label: '上臂围' },
  { type: 'THIGH', label: '大腿围' },
  { type: 'RESTING_HEART_RATE', label: '静息心率' }
]

const rangeOptions = [
  { label: '30天', value: 30 },
  { label: '90天', value: 90 }
]

const metricType = ref<BodyMetricType>('WEIGHT')
const title = ref('体重')
const rangeLimit = ref(30)
const loading = ref(false)
const points = ref<BodyMetricTrendPoint[]>([])

const currentPoint = computed(() => points.value[points.value.length - 1])
const previousPoint = computed(() => {
  if (points.value.length < 2) return null
  return points.value[points.value.length - 2]
})
const unit = computed(() => currentPoint.value?.unit || points.value[0]?.unit || '')
const values = computed(() => points.value.map((point) => point.value))
const minValue = computed(() => (values.value.length ? Math.min(...values.value) : null))
const maxValue = computed(() => (values.value.length ? Math.max(...values.value) : null))
const averageValue = computed(() => {
  if (!values.value.length) return null
  const total = values.value.reduce((sum, value) => sum + value, 0)
  return Number((total / values.value.length).toFixed(2))
})
const changeText = computed(() => {
  if (!currentPoint.value || !previousPoint.value) return '暂无趋势'
  const diff = Number((currentPoint.value.value - previousPoint.value.value).toFixed(2))
  if (diff === 0) return '较上次持平'
  return `较上次 ${diff > 0 ? '+' : ''}${diff}${unit.value}`
})
const statusText = computed(() => {
  if (loading.value) return '加载中'
  if (!points.value.length) return '暂无记录'
  return `${points.value.length} 条`
})

onLoad((query) => {
  const nextType = String(query?.metricType || '').toUpperCase()
  const matched = metricOptions.find((option) => option.type === nextType)
  if (matched) {
    metricType.value = matched.type
    title.value = decodeQueryTitle(query?.title, matched.label)
  }
})

onShow(async () => {
  const ok = await ensureFeatureAuth('身体指标趋势')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await loadTrend()
})

function goBack() {
  uni.navigateBack()
}

async function loadTrend() {
  loading.value = true
  try {
    points.value = await fetchBodyMetricTrend(metricType.value, rangeLimit.value)
  } catch (err) {
    uni.showToast({ title: '趋势数据加载失败', icon: 'none' })
    console.error('[body-metric-trend] load failed', err)
  } finally {
    loading.value = false
  }
}

function selectRange(value: number) {
  if (rangeLimit.value === value || loading.value) return
  rangeLimit.value = value
  loadTrend()
}

function formatMetric(value: number | null) {
  if (value === null) return '--'
  return `${Number(value)}${unit.value}`
}

function decodeQueryTitle(value: unknown, fallback: string) {
  if (!value) return fallback
  try {
    return decodeURIComponent(String(value))
  } catch {
    return fallback
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell metric-trend safe-bottom">
      <AppHeader :title="`${title}趋势`" subtitle="身体指标变化分析" show-back @back="goBack" />

      <view class="metric-trend__hero surface-card">
        <view>
          <view class="eyebrow">Metric Trend</view>
          <view class="metric-trend__hero-title">{{ title }}</view>
          <view class="metric-trend__hero-sub">
            仅加载当前指标的最近记录，用于快速查看变化方向和波动范围。
          </view>
        </view>
        <view class="status-pill">{{ statusText }}</view>
      </view>

      <view class="metric-trend__summary">
        <view class="metric-trend__summary-card">
          <view class="metric-trend__summary-label">当前值</view>
          <view class="metric-trend__summary-value">
            {{ currentPoint ? `${Number(currentPoint.value)}${unit}` : '--' }}
          </view>
          <view class="metric-trend__summary-meta">{{ currentPoint?.date || '未记录' }}</view>
        </view>
        <view class="metric-trend__summary-card">
          <view class="metric-trend__summary-label">变化</view>
          <view class="metric-trend__summary-value metric-trend__summary-value--accent">
            {{ changeText }}
          </view>
          <view class="metric-trend__summary-meta">相邻两次记录</view>
        </view>
      </view>

      <view class="metric-trend__chart surface-card">
        <view class="section-heading">
          <view>
            <view class="section-label">TREND</view>
            <view class="section-title">变化趋势</view>
          </view>
          <view class="metric-trend__ranges">
            <button
              v-for="option in rangeOptions"
              :key="option.value"
              class="metric-trend__range btn-press"
              :class="{ 'metric-trend__range--active': rangeLimit === option.value }"
              @tap="selectRange(option.value)"
            >
              {{ option.label }}
            </button>
          </view>
        </view>

        <MetricTrendChart
          canvas-id="bodyMetricTrendCanvas"
          :points="points"
          :unit="unit"
          :height="230"
        />
      </view>

      <view class="metric-trend__stats surface-card">
        <view class="section-heading">
          <view>
            <view class="section-label">RANGE</view>
            <view class="section-title">区间统计</view>
          </view>
        </view>
        <view class="metric-trend__stat-grid">
          <view class="metric-trend__stat">
            <view class="metric-trend__stat-label">最低</view>
            <view class="metric-trend__stat-value">{{ formatMetric(minValue) }}</view>
          </view>
          <view class="metric-trend__stat">
            <view class="metric-trend__stat-label">最高</view>
            <view class="metric-trend__stat-value">{{ formatMetric(maxValue) }}</view>
          </view>
          <view class="metric-trend__stat">
            <view class="metric-trend__stat-label">平均</view>
            <view class="metric-trend__stat-value">{{ formatMetric(averageValue) }}</view>
          </view>
        </view>
      </view>

      <view class="metric-trend__records surface-card">
        <view class="section-heading">
          <view>
            <view class="section-label">RECORDS</view>
            <view class="section-title">最近记录</view>
          </view>
        </view>
        <view v-if="points.length" class="metric-trend__record-list">
          <view
            v-for="point in points.slice().reverse()"
            :key="point.date"
            class="metric-trend__record"
          >
            <view class="metric-trend__record-date">{{ point.date }}</view>
            <view class="metric-trend__record-value"
              >{{ Number(point.value) }}{{ point.unit }}</view
            >
          </view>
        </view>
        <view v-else class="metric-trend__empty">
          {{ loading ? '正在加载趋势数据...' : '暂无记录，保存两次后会生成趋势图。' }}
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.metric-trend {
  &__hero {
    padding: 26rpx;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18rpx;
  }

  &__hero-title {
    margin-top: 6rpx;
    color: #f7f7fb;
    font-size: 42rpx;
    font-weight: 900;
    line-height: 1.15;
  }

  &__hero-sub {
    margin-top: 10rpx;
    color: #9d9daf;
    font-size: 23rpx;
    line-height: 1.45;
  }

  &__summary {
    margin-top: 24rpx;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16rpx;
  }

  &__summary-card {
    min-height: 150rpx;
    padding: 24rpx;
    border-radius: 26rpx;
    background: rgba(255, 255, 255, 0.055);
    border: 1rpx solid rgba(255, 255, 255, 0.08);
  }

  &__summary-label,
  &__summary-meta,
  &__stat-label {
    color: #8c8ca0;
    font-size: 22rpx;
    font-weight: 700;
  }

  &__summary-value {
    margin-top: 12rpx;
    color: #f7f7fb;
    font-size: 32rpx;
    font-weight: 900;
    line-height: 1.2;

    &--accent {
      color: #ff7b3c;
      font-size: 28rpx;
    }
  }

  &__summary-meta {
    margin-top: 8rpx;
  }

  &__chart,
  &__stats,
  &__records {
    margin-top: 24rpx;
    padding: 26rpx;
  }

  &__ranges {
    display: flex;
    gap: 10rpx;
  }

  &__range {
    min-height: 54rpx;
    margin: 0;
    padding: 0 18rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.08);
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c8c8d4;
    background: rgba(255, 255, 255, 0.06);
    font-size: 22rpx;
    font-weight: 900;

    &::after {
      border: 0;
    }

    &--active {
      color: #ff7b3c;
      background: rgba(255, 80, 30, 0.14);
      border-color: rgba(255, 80, 30, 0.58);
    }
  }

  &__stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14rpx;
  }

  &__stat {
    padding: 20rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.045);
    border: 1rpx solid rgba(255, 255, 255, 0.075);
  }

  &__stat-value {
    margin-top: 10rpx;
    color: #f7f7fb;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__record-list {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__record {
    min-height: 72rpx;
    padding: 0 20rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.045);
    border: 1rpx solid rgba(255, 255, 255, 0.075);
  }

  &__record-date {
    color: #c8c8d4;
    font-size: 23rpx;
    font-weight: 800;
  }

  &__record-value {
    color: #ff7b3c;
    font-size: 24rpx;
    font-weight: 900;
  }

  &__empty {
    padding: 24rpx;
    border-radius: 22rpx;
    color: #828296;
    background: rgba(255, 255, 255, 0.045);
    font-size: 23rpx;
    line-height: 1.5;
  }
}
</style>
