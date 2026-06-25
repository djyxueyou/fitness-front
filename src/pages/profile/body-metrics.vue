<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import {
  fetchBodyMetricHistory,
  fetchLatestBodyMetrics,
  type BodyMetricHistoryDayResponse,
  type BodyMetricResponse,
  type BodyMetricType,
  updateBodyMetrics
} from '@/api/user'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

type MetricConfig = {
  type: BodyMetricType
  label: string
  unit: string
  min: number
  max: number
  placeholder: string
}

const metricConfigs: MetricConfig[] = [
  { type: 'WEIGHT', label: '体重', unit: 'kg', min: 20, max: 300, placeholder: '例如 65.5' },
  { type: 'BODY_FAT', label: '体脂率', unit: '%', min: 3, max: 70, placeholder: '例如 18.5' },
  { type: 'WAIST', label: '腰围', unit: 'cm', min: 30, max: 250, placeholder: '例如 82' },
  { type: 'CHEST', label: '胸围', unit: 'cm', min: 30, max: 250, placeholder: '例如 96' },
  { type: 'HIP', label: '臀围', unit: 'cm', min: 30, max: 250, placeholder: '例如 94' },
  { type: 'ARM', label: '上臂围', unit: 'cm', min: 10, max: 80, placeholder: '例如 34' },
  { type: 'THIGH', label: '大腿围', unit: 'cm', min: 20, max: 120, placeholder: '例如 58' },
  {
    type: 'RESTING_HEART_RATE',
    label: '静息心率',
    unit: 'bpm',
    min: 30,
    max: 220,
    placeholder: '例如 62'
  }
]

const saving = ref(false)
const loading = ref(false)
const metricInputs = ref<Record<BodyMetricType, string>>({
  WEIGHT: '',
  BODY_FAT: '',
  WAIST: '',
  CHEST: '',
  HIP: '',
  ARM: '',
  THIGH: '',
  RESTING_HEART_RATE: ''
})
const latestMetrics = ref<BodyMetricResponse[]>([])
const metricHistory = ref<BodyMetricHistoryDayResponse[]>([])
const recentHistory = computed(() => metricHistory.value.slice(0, 5))

onShow(async () => {
  const ok = await ensureFeatureAuth('身体指标')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await loadMetrics()
})

function goBack() {
  uni.navigateBack()
}

async function loadMetrics() {
  loading.value = true
  try {
    const [latest, history] = await Promise.all([
      fetchLatestBodyMetrics(),
      fetchBodyMetricHistory({ limit: 5 })
    ])
    latestMetrics.value = latest
    metricHistory.value = history.items
    for (const config of metricConfigs) {
      const metric = latestMetrics.value.find((item) => item.metricType === config.type)
      metricInputs.value[config.type] = metric ? String(Number(metric.value)) : ''
    }
  } catch (err) {
    uni.showToast({ title: '指标加载失败', icon: 'none' })
    console.error('[body-metrics] load failed', err)
  } finally {
    loading.value = false
  }
}

function parseMetric(config: MetricConfig) {
  const raw = metricInputs.value[config.type].trim()
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < config.min || parsed > config.max) {
    throw new Error(`${config.label}需在 ${config.min}-${config.max}${config.unit} 之间`)
  }
  return Number(parsed.toFixed(2))
}

async function save() {
  if (saving.value) return
  try {
    const metrics = metricConfigs
      .map((config) => {
        const value = parseMetric(config)
        return value === null ? null : { metricType: config.type, value }
      })
      .filter((item): item is { metricType: BodyMetricType; value: number } => item !== null)

    if (!metrics.length) {
      uni.showToast({ title: '请至少填写一项指标', icon: 'none' })
      return
    }

    saving.value = true
    await updateBodyMetrics({ metrics })
    await loadMetrics()
    uni.showToast({ title: '身体指标已保存', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: err instanceof Error ? err.message : '保存失败，请重试', icon: 'none' })
    console.error('[body-metrics] save failed', err)
  } finally {
    saving.value = false
  }
}

function latestText(type: BodyMetricType) {
  const metric = latestMetrics.value.find((item) => item.metricType === type)
  if (!metric) return '未记录'
  return `${Number(metric.value)}${metric.unit} · ${metric.measuredAt || '今日'}`
}

function metricChangeText(type: BodyMetricType) {
  const entries = metricHistory.value
    .flatMap((day) =>
      day.metrics
        .filter((metric) => metric.metricType === type)
        .map((metric) => ({
          measuredAt: day.measuredAt,
          value: Number(metric.value),
          unit: metric.unit
        }))
    )
    .filter((metric) => Number.isFinite(metric.value))

  if (entries.length < 2) return '暂无趋势'
  const latest = entries[0]
  const previous = entries.find((metric) => metric.measuredAt !== latest.measuredAt) || entries[1]
  if (!previous) return '暂无趋势'
  const diff = Number((latest.value - previous.value).toFixed(2))
  if (diff === 0) return '较上次持平'
  return `较上次 ${diff > 0 ? '+' : ''}${diff}${latest.unit}`
}

function formatHistoryMetric(metric: BodyMetricHistoryDayResponse['metrics'][number]) {
  return `${metric.label || metric.metricType} ${Number(metric.value)}${metric.unit}`
}

function openHistory() {
  uni.navigateTo({ url: routes.profileBodyMetricHistory })
}

function openTrend(config: MetricConfig) {
  uni.navigateTo({
    url: `${routes.profileBodyMetricTrend}?metricType=${config.type}&title=${encodeURIComponent(config.label)}`
  })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell body-metrics safe-bottom" :class="themeStore.themeClass">
      <AppHeader
        title="身体指标"
        subtitle="记录体脂、围度和心率，用于趋势分析"
        show-back
        @back="goBack"
      />

      <view class="body-metrics__hero surface-card">
        <view class="body-metrics__hero-icon">◎</view>
        <view class="body-metrics__hero-body">
          <view class="eyebrow">Body Metrics</view>
          <view class="body-metrics__hero-title">专业指标档案</view>
          <view class="body-metrics__hero-sub">
            指标会按日期保存，后续用于体型变化和训练反馈分析。
          </view>
        </view>
      </view>

      <view class="body-metrics__section surface-card">
        <view class="section-heading">
          <view>
            <view class="section-label">TODAY</view>
            <view class="section-title">今日记录</view>
          </view>
          <view class="status-pill">{{ loading ? '加载中' : '可选' }}</view>
        </view>

        <view class="body-metrics__grid">
          <view v-for="config in metricConfigs" :key="config.type" class="field-panel">
            <view class="body-metrics__field-head">
              <view>
                <view class="field-label">{{ config.label }}</view>
                <view class="body-metrics__latest">{{ latestText(config.type) }}</view>
                <view class="body-metrics__trend">{{ metricChangeText(config.type) }}</view>
              </view>
              <view class="body-metrics__unit">{{ config.unit }}</view>
            </view>
            <input
              class="field-input"
              v-model="metricInputs[config.type]"
              type="digit"
              :placeholder="config.placeholder"
              placeholder-class="body-metrics__placeholder"
            />
            <button class="body-metrics__trend-link btn-press" @tap="openTrend(config)">
              查看趋势
            </button>
          </view>
        </view>
      </view>

      <view class="body-metrics__section surface-card">
        <view class="section-heading">
          <view>
            <view class="section-label">HISTORY</view>
            <view class="section-title">最近记录</view>
          </view>
          <view class="status-pill">最近 {{ recentHistory.length || 5 }} 天</view>
        </view>

        <view v-if="recentHistory.length" class="body-metrics__history-list">
          <view
            v-for="day in recentHistory"
            :key="day.measuredAt"
            class="body-metrics__history-row"
          >
            <view class="body-metrics__history-date">{{ day.measuredAt }}</view>
            <view class="body-metrics__history-chips">
              <view
                v-for="metric in day.metrics"
                :key="`${day.measuredAt}-${metric.metricType}`"
                class="body-metrics__history-chip"
              >
                {{ formatHistoryMetric(metric) }}
              </view>
            </view>
          </view>
          <button class="body-metrics__history-more btn-press" @tap="openHistory">
            查看全部记录 ›
          </button>
        </view>
        <view v-else class="body-metrics__empty">暂无历史记录，保存一次指标后会在这里展示。</view>
      </view>

      <view class="bottom-action-bar">
        <PrimaryButton :disabled="saving || loading" :loading="saving" @tap="save">
          {{ saving ? '保存中...' : '保存身体指标' }}
        </PrimaryButton>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.body-metrics {
  &__hero {
    display: flex;
    align-items: center;
    gap: 22rpx;
    padding: 26rpx;
  }

  &__hero-icon {
    width: 94rpx;
    height: 94rpx;
    border-radius: 30rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border: 1rpx solid rgba(255, 80, 30, 0.28);
    font-size: 42rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__hero-body {
    min-width: 0;
    flex: 1;
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

  &__section {
    margin-top: 24rpx;
    padding: 26rpx;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16rpx;
  }

  &__field-head {
    min-height: 62rpx;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12rpx;
  }

  &__latest {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 20rpx;
    line-height: 1.35;
  }

  &__trend {
    margin-top: 6rpx;
    color: var(--app-accent);
    font-size: 20rpx;
    font-weight: 800;
    line-height: 1.35;
  }

  &__unit {
    min-height: 42rpx;
    padding: 0 12rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    font-size: 20rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__placeholder {
    color: var(--app-text-muted);
  }

  &__trend-link {
    min-height: 48rpx;
    margin: 14rpx 0 0;
    padding: 0;
    border: 0;
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    color: var(--app-accent);
    background: transparent;
    font-size: 21rpx;
    font-weight: 900;
    line-height: 1.2;

    &::after {
      border: 0;
    }
  }

  &__history-list {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__history-row {
    padding: 20rpx;
    border-radius: 22rpx;
    background: var(--app-bg);
    border: 1rpx solid var(--app-border);
  }

  &__history-date {
    color: var(--app-text);
    font-size: 25rpx;
    font-weight: 900;
  }

  &__history-chips {
    margin-top: 14rpx;
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
  }

  &__history-chip {
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

  &__history-more {
    margin: 4rpx 0 0;
    padding: 0;
    border: 0;
    color: var(--app-accent);
    background: transparent;
    font-size: 24rpx;
    font-weight: 900;
    line-height: 1.4;
    text-align: left;

    &::after {
      border: 0;
    }
  }

  &__empty {
    padding: 24rpx;
    border-radius: 22rpx;
    color: var(--app-text-muted);
    background: var(--app-bg);
    font-size: 23rpx;
    line-height: 1.5;
  }
}
</style>
