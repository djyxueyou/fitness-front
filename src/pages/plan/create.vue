<script setup lang="ts">
import { computed, ref } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import { usePlanStore } from '@/stores/plan'
import { routes } from '@/utils/navigation'

const planStore = usePlanStore()
const name = ref('我的训练计划')
const cycleWeeks = ref(4)
const busy = ref(false)
const quickWeeks = [4, 6, 8, 12]
const canSave = computed(() => name.value.trim().length > 0 && cycleWeeks.value >= 1 && cycleWeeks.value <= 12)

function changeWeeks(delta: number) {
  cycleWeeks.value = Math.min(12, Math.max(1, cycleWeeks.value + delta))
}

async function save() {
  if (!canSave.value || busy.value) return
  busy.value = true
  try {
    const detail = await planStore.createPlan({
      name: name.value.trim(),
      cycleWeeks: cycleWeeks.value
    })
    uni.redirectTo({ url: `${routes.planDetail}?id=${detail.id}` })
  } catch (err) {
    uni.showToast({ title: '创建计划失败', icon: 'none' })
    console.error('[plan] create failed', err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="page-shell safe-bottom">
    <AppHeader title="新建计划" subtitle="设置计划周期，再添加每周训练日" show-back @back="uni.navigateBack()" />
    <view class="glass-card create-card">
      <view class="field-label">计划名称</view>
      <input v-model="name" class="name-input" maxlength="30" placeholder="输入计划名称" />
      <view class="field-label cycle-label">计划周期</view>
      <view class="week-stepper">
        <button class="step-button" @tap="changeWeeks(-1)">−</button>
        <view class="week-value"><strong>{{ cycleWeeks }}</strong><text>周</text></view>
        <button class="step-button" @tap="changeWeeks(1)">＋</button>
      </view>
      <view class="quick-row">
        <button
          v-for="week in quickWeeks"
          :key="week"
          class="quick-chip"
          :class="{ 'quick-chip--active': cycleWeeks === week }"
          @tap="cycleWeeks = week"
        >{{ week }} 周</button>
      </view>
      <view class="helper-text">计划会在设定周期结束后归档，不会自动无限循环。</view>
    </view>
    <view class="bottom-action">
      <PrimaryButton :disabled="!canSave || busy" @tap="save">{{ busy ? '创建中' : '创建并添加训练日' }}</PrimaryButton>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page-shell { min-height: 100vh; padding: 28rpx 30rpx 180rpx; }
.create-card { padding: 30rpx; border-radius: 28rpx; }
.field-label { color: #f7f4f3; font-size: 30rpx; font-weight: 800; }
.cycle-label { margin-top: 42rpx; }
.name-input { height: 94rpx; margin-top: 18rpx; padding: 0 24rpx; border: 1rpx solid rgba(255,255,255,.09); border-radius: 20rpx; background: rgba(255,255,255,.04); color: #fff; font-size: 30rpx; }
.week-stepper { display: grid; grid-template-columns: 84rpx 1fr 84rpx; gap: 18rpx; align-items: center; margin-top: 20rpx; }
.step-button { width: 84rpx; height: 84rpx; padding: 0; border: 1rpx solid rgba(255,106,45,.28); border-radius: 22rpx; background: rgba(255,90,30,.1); color: #ff713d; font-size: 42rpx; }
.week-value { height: 84rpx; display: flex; align-items: center; justify-content: center; gap: 10rpx; border-radius: 22rpx; background: rgba(255,255,255,.045); color: #aaa5b3; }
.week-value strong, .week-value text { line-height: 1; }
.week-value strong { color: #fff; font-size: 48rpx; }
.week-value text { padding-top: 6rpx; font-size: 26rpx; }
.quick-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12rpx; margin-top: 20rpx; }
.quick-chip { height: 70rpx; padding: 0; border: 1rpx solid rgba(255,255,255,.08); border-radius: 18rpx; background: rgba(255,255,255,.04); color: #aaa5b3; font-size: 24rpx; }
.quick-chip--active { border-color: rgba(255,101,37,.62); background: rgba(255,83,26,.14); color: #ff713d; }
.helper-text { margin-top: 28rpx; color: #8f8a99; font-size: 24rpx; line-height: 1.6; }
.bottom-action { position: fixed; left: 30rpx; right: 30rpx; bottom: calc(env(safe-area-inset-bottom) + 24rpx); z-index: 5; }
</style>
