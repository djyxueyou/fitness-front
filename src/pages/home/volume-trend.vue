<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import GlassCard from '@/components/glass-card/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import {
  fetchAnalyticsDashboard,
  fetchMuscleDistribution,
  fetchWeeklyVolume
} from '@/api/analytics'
import { fetchActiveTrainingPlanSummary, type ActivePlanSummaryResponse } from '@/api/plan'
import { fetchBodyMetricSummary, type BodyMetricSummaryResponse } from '@/api/user'
import { useProfileStore } from '@/stores/profile'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { formatWeight } from '@/utils/unit'

interface DashboardSummary {
  totalSessions: number
  totalVolumeKg: number
  totalDurationSeconds: number
  currentStreakDays?: number | null
}

interface DashboardDelta {
  sessions: number
  volumeKg: number
  volumePercent?: number | null
  durationSeconds: number
}

const profileStore = useProfileStore()
const loading = ref(false)
const loadError = ref('')
const dashboard = ref<{ current: DashboardSummary; previous: DashboardSummary; delta: DashboardDelta } | null>(null)
const activePlan = ref<ActivePlanSummaryResponse | null>(null)
const bodySummary = ref<BodyMetricSummaryResponse | null>(null)
const weeklyVolumeData = ref<{ week: string; volume: number; sessions: number }[]>([])
const muscleDistribution = ref<{ name: string; pct: number; color: string }[]>([])
const weightUnit = computed(() => profileStore.unit)

const weeklyVolume = computed(() => weeklyVolumeData.value)
const maxVolume = computed(() => Math.max(...weeklyVolume.value.map((item) => item.volume), 1))
const hasAnalysisData = computed(
  () =>
    Boolean(dashboard.value?.current.totalSessions) ||
    Boolean(activePlan.value) ||
    weeklyVolume.value.some((item) => item.volume > 0 || item.sessions > 0) ||
    muscleDistribution.value.length > 0 ||
    Boolean(bodySummary.value?.items.length)
)
const dashboardInsight = computed(() => {
  const current = dashboard.value?.current
  const delta = dashboard.value?.delta
  if (!current || current.totalSessions <= 0) return '完成训练后，这里会汇总你的本周复盘。'
  if (!delta) return `本周已完成 ${current.totalSessions} 次训练。`
  if (delta.sessions > 0) return `本周比上周多练 ${delta.sessions} 次。`
  if (delta.sessions < 0) return `本周比上周少练 ${Math.abs(delta.sessions)} 次。`
  return '本周训练次数和上周持平。'
})

onShow(loadAnalysis)

async function loadAnalysis() {
  const ok = await ensureMembershipFeature('进阶训练分析')
  if (!ok) return
  loading.value = true
  loadError.value = ''
  try {
    const [dashboardResult, planResult, bodyResult, weekly, muscles] = await Promise.all([
      fetchAnalyticsDashboard('week'),
      fetchActiveTrainingPlanSummary(),
      fetchBodyMetricSummary(),
      fetchWeeklyVolume(6),
      fetchMuscleDistribution('month')
    ])
    dashboard.value = dashboardResult
    activePlan.value = planResult
    bodySummary.value = bodyResult
    weeklyVolumeData.value = weekly.weeks.map((item) => {
      const date = new Date(item.weekStart)
      return {
        week: `${date.getMonth() + 1}/${date.getDate()}`,
        volume: Number(item.totalVolumeKg || 0),
        sessions: Number(item.sessionCount || 0)
      }
    })
    const colors = ['#ff501e', '#50c8ff', '#c850ff', '#3dd9a2', '#ffc850']
    muscleDistribution.value = muscles.items.slice(0, 5).map((item, index) => ({
      name: item.muscle,
      pct: item.percentage,
      color: colors[index % colors.length]
    }))
  } catch (err) {
    loadError.value = '训练分析加载失败，请稍后重试。'
    dashboard.value = null
    activePlan.value = null
    bodySummary.value = null
    weeklyVolumeData.value = []
    muscleDistribution.value = []
    console.error('[analytics] analysis load failed', err)
  } finally {
    loading.value = false
  }
}

function goBack() {
  uni.navigateBack()
}

function openBodyMetrics() {
  uni.navigateTo({ url: routes.profileBodyMetrics })
}

function openPlan() {
  if (activePlan.value?.planId) {
    uni.navigateTo({ url: `${routes.planDetail}?id=${activePlan.value.planId}` })
    return
  }
  uni.switchTab({ url: routes.planIndex })
}

function formatDuration(seconds?: number | null) {
  const safeSeconds = Math.max(0, Number(seconds || 0))
  if (safeSeconds < 3600) return `${Math.round(safeSeconds / 60)} min`
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.round((safeSeconds % 3600) / 60)
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`
}

function formatSignedDuration(seconds?: number | null) {
  const numeric = Number(seconds || 0)
  if (!numeric) return '无变化'
  return `${numeric > 0 ? '+' : '-'}${formatDuration(Math.abs(numeric))}`
}

function formatSessionDelta(value?: number | null) {
  const numeric = Number(value || 0)
  if (!numeric) return '持平'
  return `${numeric > 0 ? '+' : ''}${numeric} 次`
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return '无对比'
  return `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}%`
}

function formatMetricDelta(value?: number | null, unit = '') {
  if (value === null || value === undefined) return '首次记录'
  const numeric = Number(value)
  if (!numeric) return '无变化'
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)} ${unit}`
}

function weekdayText(day?: number) {
  if (!day) return '待安排'
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][day - 1] || `第 ${day} 天`
}

function muscleSignal(pct: number) {
  if (pct >= 35) return '偏高'
  if (pct <= 8) return '偏低'
  return '正常'
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell analysis safe-bottom">
      <AppHeader title="训练分析" subtitle="复盘训练、计划和身体变化" show-back @back="goBack" />

      <view v-if="loadError" class="glass-card analysis__empty">{{ loadError }}</view>
      <view v-else-if="!loading && !hasAnalysisData" class="glass-card analysis__empty">
        完成 2 周训练后可看到周趋势；记录身体指标后可看到身体变化。
      </view>

      <view class="glass-card analysis__hero">
        <view class="analysis__hero-label">本周复盘</view>
        <view class="analysis__hero-title">{{ dashboardInsight }}</view>
        <view class="analysis__stat-grid">
          <view class="analysis__stat">
            <view class="analysis__stat-label">训练次数</view>
            <view class="analysis__stat-value">{{ dashboard?.current.totalSessions || 0 }}</view>
            <view class="analysis__stat-sub">{{ formatSessionDelta(dashboard?.delta.sessions) }} 较上周</view>
          </view>
          <view class="analysis__stat">
            <view class="analysis__stat-label">训练容量</view>
            <view class="analysis__stat-value">
              {{ formatWeight(dashboard?.current.totalVolumeKg || 0, weightUnit, 0) }}
            </view>
            <view class="analysis__stat-sub">{{ formatPercent(dashboard?.delta.volumePercent) }}</view>
          </view>
          <view class="analysis__stat">
            <view class="analysis__stat-label">训练时长</view>
            <view class="analysis__stat-value">
              {{ formatDuration(dashboard?.current.totalDurationSeconds) }}
            </view>
            <view class="analysis__stat-sub">{{ formatSignedDuration(dashboard?.delta.durationSeconds) }} 较上周</view>
          </view>
        </view>
      </view>

      <GlassCard>
        <view class="analysis__section">
          <view class="space-between">
            <view>
              <view class="analysis__section-title">计划执行</view>
              <view class="analysis__section-sub">
                {{ activePlan ? `第 ${activePlan.weekIndex} 周安排` : '还没有启用计划' }}
              </view>
            </view>
            <view class="analysis__link btn-press" @tap="openPlan">{{ activePlan ? '查看' : '去启用' }}</view>
          </view>
          <view v-if="activePlan" class="analysis__plan">
            <view class="analysis__plan-title">{{ activePlan.planName }}</view>
            <view class="analysis__plan-progress">
              <view
                class="analysis__plan-fill"
                :style="{
                  width: `${activePlan.scheduledThisWeek ? (activePlan.completedThisWeek / activePlan.scheduledThisWeek) * 100 : 0}%`
                }"
              />
            </view>
            <view class="analysis__plan-meta">
              本周 {{ activePlan.completedThisWeek }}/{{ activePlan.scheduledThisWeek }} 已完成 ·
              剩余 {{ activePlan.remainingThisWeek }} 次
            </view>
            <view class="analysis__plan-next">
              下一次：{{ weekdayText(activePlan.nextDayOfWeek) }} {{ activePlan.nextTitle || '本周计划已完成' }}
            </view>
          </view>
          <view v-else class="analysis__muted">启用计划后，这里会显示本周执行率和下一次训练。</view>
        </view>
      </GlassCard>

      <GlassCard>
        <view class="analysis__section">
          <view class="analysis__section-title">训练趋势</view>
          <view class="analysis__bars">
            <view v-for="item in weeklyVolume" :key="item.week" class="analysis__bar-item">
              <view class="analysis__bar-track">
                <view
                  class="analysis__bar-fill"
                  :style="{ height: `${Math.max(6, (item.volume / maxVolume) * 100)}%` }"
                />
              </view>
              <view class="analysis__bar-label">{{ item.week }}</view>
              <view class="analysis__bar-meta">
                {{ formatWeight(item.volume, weightUnit, 0) }} · {{ item.sessions }}次
              </view>
            </view>
          </view>
        </view>
      </GlassCard>

      <GlassCard>
        <view class="analysis__section">
          <view class="analysis__section-title">肌群分布</view>
          <view v-if="loading" class="analysis__muted">加载中...</view>
          <view v-else-if="!muscleDistribution.length" class="analysis__muted">暂无肌群分布数据</view>
          <view v-for="item in muscleDistribution" :key="item.name" class="analysis__muscle-row">
            <view class="space-between">
              <view class="analysis__muscle-name">
                <text class="analysis__muscle-dot" :style="{ background: item.color }" />
                {{ item.name }}
              </view>
              <view class="analysis__muscle-tag">{{ muscleSignal(item.pct) }} · {{ item.pct }}%</view>
            </view>
            <view class="analysis__muscle-track">
              <view
                class="analysis__muscle-fill"
                :style="{ width: `${item.pct}%`, background: item.color }"
              />
            </view>
          </view>
        </view>
      </GlassCard>

      <GlassCard>
        <view class="analysis__section">
          <view class="space-between">
            <view>
              <view class="analysis__section-title">身体变化</view>
              <view class="analysis__section-sub">
                {{ bodySummary?.latestMeasuredAt ? `最近记录 ${bodySummary.latestMeasuredAt}` : '记录指标后生成摘要' }}
              </view>
            </view>
            <view class="analysis__link btn-press" @tap="openBodyMetrics">记录</view>
          </view>
          <view v-if="bodySummary?.items.length" class="analysis__metric-list">
            <view v-for="item in bodySummary.items" :key="item.metricType" class="analysis__metric">
              <view>
                <view class="analysis__metric-label">{{ item.label }}</view>
                <view class="analysis__metric-value">{{ item.value }} {{ item.unit }}</view>
              </view>
              <view class="analysis__metric-delta">{{ formatMetricDelta(item.delta, item.unit) }}</view>
            </view>
          </view>
          <view v-else class="analysis__muted">去身体指标页记录体重、体脂或腰围后，这里会展示变化。</view>
        </view>
      </GlassCard>
    </view>
  </scroll-view>
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.analysis {
  &__empty {
    margin-bottom: 24rpx;
    padding: 24rpx;
    color: #828296;
    font-size: 24rpx;
    line-height: 1.6;
  }

  &__hero {
    margin-bottom: 24rpx;
    padding: 28rpx;
  }

  &__hero-label,
  &__section-sub,
  &__muted,
  &__stat-sub {
    color: #828296;
    font-size: 22rpx;
  }

  &__hero-title {
    margin-top: 8rpx;
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 900;
    line-height: 1.3;
  }

  &__stat-grid {
    margin-top: 24rpx;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14rpx;
  }

  &__stat {
    min-width: 0;
    padding: 18rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.045);
    border: 1rpx solid rgba(255, 255, 255, 0.06);
  }

  &__stat-label {
    color: #a6a6b8;
    font-size: 20rpx;
  }

  &__stat-value {
    margin-top: 8rpx;
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__section {
    padding: 24rpx;
    margin-bottom: 24rpx;
  }

  &__section-title {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 900;
  }

  &__link {
    padding: 10rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.14);
    color: #ff7a32;
    font-size: 22rpx;
    font-weight: 800;
  }

  &__plan {
    margin-top: 20rpx;
  }

  &__plan-title {
    color: #f5f5fa;
    font-size: 26rpx;
    font-weight: 900;
  }

  &__plan-progress {
    margin-top: 16rpx;
    height: 14rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  &__plan-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ff501e, #ffa03c);
  }

  &__plan-meta,
  &__plan-next {
    margin-top: 12rpx;
    color: #a6a6b8;
    font-size: 22rpx;
  }

  &__bars {
    margin-top: 20rpx;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12rpx;
  }

  &__bar-item {
    flex: 1;
    min-width: 0;
    text-align: center;
  }

  &__bar-track {
    height: 210rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: flex-end;
    overflow: hidden;
  }

  &__bar-fill {
    width: 100%;
    border-radius: 18rpx;
    background: linear-gradient(180deg, #ff501e 0%, #ff8e3c 100%);
  }

  &__bar-label {
    margin-top: 10rpx;
    color: #f5f5fa;
    font-size: 20rpx;
  }

  &__bar-meta {
    margin-top: 4rpx;
    color: #828296;
    font-size: 18rpx;
  }

  &__muscle-row + &__muscle-row {
    margin-top: 18rpx;
  }

  &__muscle-name {
    display: flex;
    align-items: center;
    gap: 10rpx;
    color: #f5f5fa;
    font-size: 22rpx;
  }

  &__muscle-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
  }

  &__muscle-tag {
    color: #a6a6b8;
    font-size: 21rpx;
  }

  &__muscle-track {
    margin-top: 10rpx;
    height: 12rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  &__muscle-fill {
    height: 100%;
    border-radius: inherit;
  }

  &__metric-list {
    margin-top: 18rpx;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__metric {
    padding: 18rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.045);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__metric-label {
    color: #828296;
    font-size: 21rpx;
  }

  &__metric-value {
    margin-top: 6rpx;
    color: #f5f5fa;
    font-size: 26rpx;
    font-weight: 900;
  }

  &__metric-delta {
    color: #ff7a32;
    font-size: 22rpx;
    font-weight: 800;
    white-space: nowrap;
  }
}
</style>
