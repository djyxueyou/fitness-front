<script setup lang="ts">
import { computed, ref } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import { detailExercises, historyList } from '@/mock/history'
import { formatWorkoutDate } from '@/utils/format'

const labels = {
  save: '\u5b58\u6a21\u677f',
  saved: '\u5df2\u4fdd\u5b58',
  edit: '\u7f16\u8f91\u8bb0\u5f55',
  doneEdit: '\u5b8c\u6210\u7f16\u8f91',
  duration: '\u65f6\u957f',
  calories: '\u6d88\u8017',
  volume: '\u603b\u5bb9\u91cf',
  setUnit: '\u7ec4',
  delete: '\u5220\u9664',
  addSet: '+ \u6dfb\u52a0\u7ec4'
}

const date = ref('2025-06-17')
const isEditing = ref(false)
const savedAsTemplate = ref(false)

const workout = computed(() => historyList.find((item) => item.date === date.value) ?? historyList[0])

onLoad((query) => {
  if (typeof query.date === 'string') {
    date.value = query.date
  }
})

function goBack() {
  uni.navigateBack()
}

function saveTemplate() {
  savedAsTemplate.value = true
  uni.showToast({ title: '\u5df2\u4fdd\u5b58\u4e3a\u6a21\u677f', icon: 'none' })
  setTimeout(() => {
    savedAsTemplate.value = false
  }, 1800)
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader :title="workout.name" :subtitle="formatWorkoutDate(workout.date)" show-back @back="goBack" />

      <view class="history-detail__toolbar">
        <view
          class="glass-card history-detail__tool btn-press"
          :class="{ 'history-detail__tool--active': savedAsTemplate }"
          @tap="saveTemplate"
        >
          {{ savedAsTemplate ? labels.saved : labels.save }}
        </view>
        <view
          class="glass-card history-detail__tool btn-press"
          :class="{ 'history-detail__tool--active': isEditing }"
          @tap="isEditing = !isEditing"
        >
          {{ isEditing ? labels.doneEdit : labels.edit }}
        </view>
      </view>

      <view class="history-detail__stats">
        <view class="glass-card history-detail__stat">
          <view class="history-detail__stat-icon">🕒</view>
          <view class="history-detail__stat-value">{{ workout.duration }} min</view>
          <view class="muted">{{ labels.duration }}</view>
        </view>
        <view class="glass-card history-detail__stat">
          <view class="history-detail__stat-icon">🔥</view>
          <view class="history-detail__stat-value">320 kcal</view>
          <view class="muted">{{ labels.calories }}</view>
        </view>
        <view class="glass-card history-detail__stat">
          <view class="history-detail__stat-icon">⚡</view>
          <view class="history-detail__stat-value">8,450 kg</view>
          <view class="muted">{{ labels.volume }}</view>
        </view>
      </view>

      <view class="history-detail__list">
        <view v-for="exercise in detailExercises" :key="exercise.name" class="glass-card history-detail__card">
          <view class="history-detail__card-top">
            <view class="history-detail__card-title">{{ exercise.name }}</view>
            <view class="muted">{{ exercise.sets.length }} {{ labels.setUnit }}</view>
          </view>

          <view
            v-for="(set, index) in exercise.sets"
            :key="`${exercise.name}-${index}`"
            class="history-detail__set"
          >
            <view class="history-detail__set-label">第 {{ index + 1 }} 组</view>
            <view class="history-detail__set-value">{{ set }}</view>
            <view v-if="isEditing" class="history-detail__delete">{{ labels.delete }}</view>
          </view>

          <view v-if="isEditing" class="history-detail__add-set">{{ labels.addSet }}</view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.history-detail {
  &__toolbar {
    display: flex;
    gap: 12rpx;
    margin-bottom: 20rpx;
  }

  &__tool {
    flex: 1;
    min-height: 72rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #828296;
    font-size: 22rpx;

    &--active {
      color: #fff;
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      border-color: transparent;
    }
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-bottom: 24rpx;
  }

  &__stat {
    padding: 22rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8rpx;
  }

  &__stat-icon {
    font-size: 28rpx;
  }

  &__stat-value {
    font-size: 24rpx;
    font-weight: 700;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    padding-bottom: 24rpx;
  }

  &__card {
    padding: 24rpx;
  }

  &__card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 18rpx;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  &__card-title {
    font-size: 28rpx;
    font-weight: 700;
  }

  &__set {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12rpx;
    margin-top: 14rpx;
    padding: 18rpx;
    border-radius: 22rpx;
    background: rgba(255, 80, 30, 0.08);
  }

  &__set-label {
    color: #828296;
    font-size: 22rpx;
  }

  &__set-value {
    flex: 1;
    text-align: right;
    font-weight: 700;
  }

  &__delete,
  &__add-set {
    color: #ff501e;
    font-size: 22rpx;
  }

  &__add-set {
    margin-top: 16rpx;
  }
}
</style>
