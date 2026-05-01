<script setup lang="ts">
import { computed, ref } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import GlassCard from '@/components/glass-card/index.vue'
import { historyList, workoutDays } from '@/mock/history'
import { routes } from '@/utils/navigation'
import { monthDay } from '@/utils/format'

const labels = {
  title: '\u8bad\u7ec3\u65e5\u5386',
  trend: '\u8d8b\u52bf',
  monthRecords: '\u672c\u6708\u8bb0\u5f55',
  sessions: '\u6b21\u8bad\u7ec3'
}

const currentYear = ref(2025)
const currentMonth = ref(5)
const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六']
const typeColor: Record<string, string> = {
  push: '#ff501e',
  pull: '#50c8ff',
  legs: '#c850ff'
}

const firstDay = computed(() => new Date(currentYear.value, currentMonth.value, 1).getDay())
const daysInMonth = computed(() => new Date(currentYear.value, currentMonth.value + 1, 0).getDate())
const monthRecords = computed(() =>
  historyList.filter((record) => {
    const [year, month] = record.date.split('-').map(Number)
    return year === currentYear.value && month - 1 === currentMonth.value
  })
)

function goBack() {
  uni.navigateBack()
}

function prevMonth() {
  currentMonth.value = currentMonth.value === 0 ? 11 : currentMonth.value - 1
}

function nextMonth() {
  currentMonth.value = currentMonth.value === 11 ? 0 : currentMonth.value + 1
}

function openTrend() {
  uni.navigateTo({ url: routes.volumeTrend })
}

function openDetail(date: string) {
  uni.navigateTo({ url: `${routes.historyDetail}?date=${date}` })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader :title="labels.title" show-back @back="goBack">
        <template #right>
          <view class="glass-card calendar__trend btn-press" @tap="openTrend">{{ labels.trend }}</view>
        </template>
      </AppHeader>

      <view class="calendar__month-nav">
        <view class="glass-card calendar__month-btn btn-press" @tap="prevMonth">‹</view>
        <view class="calendar__month-title">{{ currentYear }}年{{ currentMonth + 1 }}月</view>
        <view class="glass-card calendar__month-btn btn-press" @tap="nextMonth">›</view>
      </view>

      <GlassCard>
        <view class="calendar__grid-card">
          <view class="calendar__header-row">
            <view v-for="day in daysOfWeek" :key="day" class="calendar__header-cell">{{ day }}</view>
          </view>
          <view class="calendar__grid">
            <view v-for="empty in firstDay" :key="`empty-${empty}`" class="calendar__grid-cell" />
            <view v-for="day in daysInMonth" :key="day" class="calendar__grid-cell">
              <view
                class="calendar__grid-button btn-press"
                :style="workoutDays[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`]
                  ? { background: `${typeColor[workoutDays[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`].type]}22` }
                  : {}"
                @tap="workoutDays[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`] && openDetail(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)"
              >
                <view
                  class="calendar__grid-number"
                  :style="workoutDays[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`]
                    ? { color: typeColor[workoutDays[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`].type] }
                    : {}"
                >
                  {{ day }}
                </view>
                <view
                  v-if="workoutDays[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`]"
                  class="calendar__grid-dot"
                  :style="{ background: typeColor[workoutDays[`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`].type] }"
                />
              </view>
            </view>
          </view>
        </view>
      </GlassCard>

      <view class="calendar__legend">
        <view class="calendar__legend-item"><text class="calendar__legend-dot" style="background:#ff501e" />Push</view>
        <view class="calendar__legend-item"><text class="calendar__legend-dot" style="background:#50c8ff" />Pull</view>
        <view class="calendar__legend-item"><text class="calendar__legend-dot" style="background:#c850ff" />Legs</view>
        <view class="muted">{{ monthRecords.length }} {{ labels.sessions }}</view>
      </view>

      <view class="section-label calendar__section-label">{{ labels.monthRecords }}</view>
      <view class="calendar__list">
        <view v-for="record in monthRecords" :key="record.date" class="glass-card calendar__record btn-press" @tap="openDetail(record.date)">
          <view class="calendar__record-icon" :style="{ background: `${typeColor[record.type]}22`, color: typeColor[record.type] }">🔥</view>
          <view class="calendar__record-body">
            <view class="calendar__record-name">{{ record.name }}</view>
            <view class="calendar__record-meta">{{ monthDay(record.date) }} · {{ record.duration }} min</view>
          </view>
          <view class="calendar__record-arrow">›</view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.calendar {
  &__trend,
  &__month-btn {
    min-width: 72rpx;
    min-height: 72rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #828296;
  }

  &__month-nav,
  &__legend {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
  }

  &__month-nav {
    margin-bottom: 24rpx;
  }

  &__month-title {
    font-size: 30rpx;
    font-weight: 700;
  }

  &__grid-card {
    padding: 24rpx;
  }

  &__header-row,
  &__grid {
    display: flex;
    flex-wrap: wrap;
  }

  &__header-cell,
  &__grid-cell {
    width: 14.285%;
    display: flex;
    justify-content: center;
  }

  &__header-cell {
    color: #828296;
    font-size: 20rpx;
    margin-bottom: 12rpx;
  }

  &__grid-button {
    width: 72rpx;
    height: 72rpx;
    border-radius: 20rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6rpx;
  }

  &__grid-number {
    color: #828296;
    font-size: 22rpx;
    font-weight: 700;
  }

  &__grid-dot,
  &__legend-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
    display: inline-block;
  }

  &__legend {
    margin: 20rpx 0 32rpx;
    flex-wrap: wrap;
  }

  &__legend-item {
    color: #828296;
    font-size: 22rpx;
    display: flex;
    align-items: center;
    gap: 8rpx;
  }

  &__section-label {
    margin-bottom: 18rpx;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__record {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 22rpx;
  }

  &__record-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__record-body {
    flex: 1;
  }

  &__record-name {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__record-meta {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__record-arrow {
    color: #828296;
    font-size: 32rpx;
  }
}
</style>
