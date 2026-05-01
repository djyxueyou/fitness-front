<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import GlassCard from '@/components/glass-card/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import SectionTitle from '@/components/section-title/index.vue'
import StatCard from '@/components/stat-card/index.vue'
import { getToken } from '@/api/http'
import { fetchTrainingSummary, type TrainingStatsSummaryResponse } from '@/api/training'
import { routes } from '@/utils/navigation'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { useTemplateStore } from '@/stores/template'
import { formatWeight, resolveWeightUnit } from '@/utils/unit'

const templateStore = useTemplateStore()
const summary = ref<TrainingStatsSummaryResponse | null>(null)
const unit = computed(() => resolveWeightUnit())

const weekStats = [
  { day: '一', done: false, vol: 0 },
  { day: '二', done: false, vol: 0 },
  { day: '三', done: false, vol: 0 },
  { day: '四', done: false, vol: 0 },
  { day: '五', done: false, vol: 0 },
  { day: '六', done: false, vol: 0 },
  { day: '日', done: false, vol: 0, isToday: true }
]

const recentTemplates = computed(() => templateStore.recentItems)
const totalSessions = computed(() => summary.value ? `${summary.value.totalSessions} 次` : '--')
const totalVolume = computed(() => summary.value ? `${formatWeight(summary.value.totalVolumeKg, unit.value, 0)} ${unit.value}` : '--')
const totalDuration = computed(() => summary.value ? `${Math.round(summary.value.totalDurationSeconds / 60)} min` : '--')

async function goSelectTemplate() {
  uni.navigateTo({ url: routes.selectTemplate })
}

async function goCalendar() {
  const ok = await ensureFeatureAuth('训练日历')
  if (!ok) return
  uni.navigateTo({ url: routes.workoutCalendar })
}

async function loadSummaryIfLoggedIn() {
  if (!getToken()) return
  try {
    summary.value = await fetchTrainingSummary()
  } catch (err) {
    console.error('[home] summary fetch failed', err)
  }
}

onMounted(() => {
  templateStore.loadTemplates()
  loadSummaryIfLoggedIn()
})
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell home-page safe-bottom">
      <view class="home-page__hero">
        <view class="muted">早上好</view>
        <view class="title-xl">
          准备好<text class="text-gradient-fire">燃烧</text>了吗？
        </view>
      </view>

      <view class="home-page__stats">
        <StatCard icon="🔥" label="本周训练" :value="totalSessions" />
        <StatCard icon="⚡" label="总容量" :value="totalVolume" />
        <StatCard icon="⏱" label="总时长" :value="totalDuration" />
      </view>

      <GlassCard>
        <view class="home-page__week-card">
          <view class="space-between">
            <view class="home-page__section-title">本周训练</view>
            <view class="home-page__link" @tap="goCalendar">查看全部</view>
          </view>
          <view class="home-page__week-bars">
            <view v-for="item in weekStats" :key="item.day" class="home-page__week-col">
              <view class="home-page__week-bar" :class="{ 'home-page__week-bar--done': item.done }" :style="{ height: `${72 + item.vol}rpx` }" />
              <view class="home-page__week-label" :class="{ 'home-page__week-label--today': item.isToday }">{{ item.day }}</view>
            </view>
          </view>
        </view>
      </GlassCard>

      <view class="home-page__cta">
        <PrimaryButton @tap="goSelectTemplate">
          <view class="home-page__cta-inner">
            <view class="home-page__cta-icon">▶</view>
            <view class="home-page__cta-copy">
              <view class="home-page__cta-title">开始训练</view>
              <view class="home-page__cta-sub">选择模板或开启自由训练</view>
            </view>
            <view class="home-page__cta-arrow">›</view>
          </view>
        </PrimaryButton>
      </view>

      <view class="home-page__section">
        <SectionTitle title="最近使用" action-text="全部" @action="goSelectTemplate" />
        <view class="home-page__list">
          <view v-for="item in recentTemplates" :key="item.id" class="glass-card home-page__recent btn-press" @tap="goSelectTemplate">
            <view class="home-page__recent-icon">🔥</view>
            <view class="home-page__recent-body">
              <view class="home-page__recent-name">{{ item.name }}</view>
              <view class="home-page__recent-meta">{{ item.exercises }} 个动作 · {{ item.duration }} min</view>
            </view>
            <view class="home-page__recent-play">▶</view>
          </view>
        </view>
      </view>

      <view class="glass-card home-page__calendar-link btn-press" @tap="goCalendar">
        <view class="home-page__calendar-icon">📅</view>
        <view class="home-page__calendar-body">
          <view class="home-page__recent-name">训练日历</view>
          <view class="home-page__recent-meta">查看训练历史记录和趋势</view>
        </view>
        <view class="home-page__cta-arrow">›</view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.home-page {
  &__hero {
    margin-bottom: 28rpx;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-bottom: 24rpx;
  }

  &__week-card {
    padding: 28rpx;
  }

  &__section-title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__link {
    color: #ff501e;
    font-size: 22rpx;
  }

  &__week-bars {
    display: flex;
    gap: 12rpx;
    align-items: flex-end;
    margin-top: 28rpx;
  }

  &__week-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
  }

  &__week-bar {
    width: 100%;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.08);

    &--done {
      background: linear-gradient(180deg, #ff501e 0%, #ffa03c 100%);
    }
  }

  &__week-label {
    color: #828296;
    font-size: 22rpx;

    &--today {
      color: #ff501e;
      font-weight: 700;
    }
  }

  &__cta {
    margin-top: 24rpx;
  }

  &__cta-inner {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__cta-icon,
  &__recent-play,
  &__calendar-icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__cta-icon {
    background: rgba(255, 255, 255, 0.2);
    font-size: 26rpx;
  }

  &__cta-copy {
    flex: 1;
  }

  &__cta-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #fff;
  }

  &__cta-sub {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.78);
  }

  &__cta-arrow {
    font-size: 36rpx;
    color: #828296;
  }

  &__section {
    margin-top: 36rpx;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__recent,
  &__calendar-link {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 24rpx;
  }

  &__recent-icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.15);
  }

  &__recent-body,
  &__calendar-body {
    flex: 1;
  }

  &__recent-name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__recent-meta {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: #828296;
  }

  &__recent-play {
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    font-size: 24rpx;
  }

  &__calendar-link {
    margin-top: 20rpx;
  }
}
</style>
