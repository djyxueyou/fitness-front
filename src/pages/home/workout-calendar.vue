<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import GlassCard from '@/components/glass-card/index.vue'
import { routes } from '@/utils/navigation'
import { useTrainingStore } from '@/stores/training'

const trainingStore = useTrainingStore()
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())
const selectedDate = ref('')
const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六']

onShow(async () => {
  await Promise.all([
    trainingStore.fetchHistory(),
    trainingStore.fetchCalendar(currentYear.value, currentMonth.value + 1)
  ])
})

const firstDay = computed(() => new Date(currentYear.value, currentMonth.value, 1).getDay())
const daysInMonth = computed(() => new Date(currentYear.value, currentMonth.value + 1, 0).getDate())

const monthRecords = computed(() =>
  trainingStore.history.filter((record) => {
    const date = new Date(record.startedAt)
    return date.getFullYear() === currentYear.value && date.getMonth() === currentMonth.value
  })
)

const recordMap = computed(() => {
  const map: Record<string, typeof trainingStore.history> = {}
  monthRecords.value.forEach((record) => {
    const date = new Date(record.startedAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
    map[key] = [...(map[key] || []), record]
  })
  return map
})

const selectedRecords = computed(() => {
  if (!selectedDate.value) return monthRecords.value
  return recordMap.value[selectedDate.value] || []
})

const selectedTitle = computed(() => {
  if (!selectedDate.value) return '本月记录'
  return `${selectedDate.value.slice(5)} 训练记录`
})

const calendarMap = computed(() => {
  const map: Record<string, { sessionCount: number; totalVolumeKg: number }> = {}
  trainingStore.calendarDays.forEach((day) => {
    map[day.trainingDate] = {
      sessionCount: Number(day.sessionCount || 0),
      totalVolumeKg: Number(day.totalVolumeKg || 0)
    }
  })
  return map
})

function goBack() {
  uni.navigateBack()
}

async function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value -= 1
  } else {
    currentMonth.value -= 1
  }
  selectedDate.value = ''
  await trainingStore.fetchCalendar(currentYear.value, currentMonth.value + 1)
}

async function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value += 1
  } else {
    currentMonth.value += 1
  }
  selectedDate.value = ''
  await trainingStore.fetchCalendar(currentYear.value, currentMonth.value + 1)
}

function openTrend() {
  uni.navigateTo({ url: routes.volumeTrend })
}

function openDetailById(id: number) {
  uni.navigateTo({ url: `${routes.historyDetail}?id=${id}` })
}

function dayKey(day: number) {
  return `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function selectDay(day: number) {
  const key = dayKey(day)
  if (!calendarMap.value[key]) return
  selectedDate.value = key
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="训练日历" subtitle="按月份浏览训练记录" show-back @back="goBack">
        <template #right>
          <view class="glass-card calendar__trend btn-press" @tap="openTrend">趋势</view>
        </template>
      </AppHeader>

      <view class="calendar__month-nav">
        <view class="glass-card calendar__month-btn btn-press" @tap="prevMonth">‹</view>
        <view class="calendar__month-title">{{ currentYear }} 年 {{ currentMonth + 1 }} 月</view>
        <view class="glass-card calendar__month-btn btn-press" @tap="nextMonth">›</view>
      </view>

      <GlassCard>
        <view class="calendar__grid-card">
          <view class="calendar__header-row">
            <view v-for="day in daysOfWeek" :key="day" class="calendar__header-cell">{{
              day
            }}</view>
          </view>
          <view class="calendar__grid">
            <view v-for="empty in firstDay" :key="`empty-${empty}`" class="calendar__grid-cell" />
            <view v-for="day in daysInMonth" :key="day" class="calendar__grid-cell">
              <view
                class="calendar__grid-button btn-press"
                :class="{
                  'calendar__grid-button--done': calendarMap[dayKey(day)],
                  'calendar__grid-button--selected': selectedDate === dayKey(day)
                }"
                @tap="selectDay(day)"
              >
                <view class="calendar__grid-number">{{ day }}</view>
                <view v-if="calendarMap[dayKey(day)]" class="calendar__grid-dot" />
              </view>
            </view>
          </view>
        </view>
      </GlassCard>

      <view class="section-label calendar__section-label">{{ selectedTitle }}</view>
      <view class="calendar__list">
        <view
          v-for="record in selectedRecords"
          :key="record.id"
          class="glass-card calendar__record btn-press"
          @tap="openDetailById(record.id)"
        >
          <view class="calendar__record-icon">🎸</view>
          <view class="calendar__record-body">
            <view class="calendar__record-name">{{ record.trainingName }}</view>
            <view class="calendar__record-meta"
              >{{ Math.round(record.durationSeconds / 60) }} min · {{ record.totalSetCount }} 组 ·
              {{ Number(record.totalVolumeKg || 0).toFixed(0) }} kg</view
            >
          </view>
          <view class="calendar__record-arrow">›</view>
        </view>
        <view v-if="!selectedRecords.length" class="glass-card calendar__empty">
          当前日期没有训练记录。
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

  &__trend {
    padding: 0 22rpx;
    color: #f5f5fa;
    font-size: 22rpx;
  }

  &__month-nav {
    margin-bottom: 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
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
    background: rgba(255, 255, 255, 0.03);

    &--done {
      background: rgba(255, 80, 30, 0.16);
    }

    &--selected {
      border: 1px solid rgba(255, 80, 30, 0.65);
      box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.16);
    }
  }

  &__grid-number {
    color: #f5f5fa;
    font-size: 22rpx;
    font-weight: 700;
  }

  &__grid-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
    background: #ff501e;
  }

  &__section-label {
    margin: 22rpx 0 18rpx;
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
    background: rgba(255, 80, 30, 0.14);
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

  &__empty {
    padding: 28rpx;
    color: #828296;
    font-size: 24rpx;
  }
}
</style>
