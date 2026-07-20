<script setup lang="ts">
import { computed, ref } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import { usePlanStore } from '@/stores/plan'
import { useThemeStore } from '@/stores/theme'
import { routes } from '@/utils/navigation'
import { showPlanWriteError } from '@/utils/plan-write-feedback'

const planStore = usePlanStore()
const themeStore = useThemeStore()
const name = ref('我的训练计划')
const cycleWeeks = ref(4)
const busy = ref(false)
const quickWeeks = [4, 6, 8, 12]
const canSave = computed(
  () => name.value.trim().length > 0 && cycleWeeks.value >= 1 && cycleWeeks.value <= 12
)

function changeWeeks(delta: number) {
  cycleWeeks.value = Math.min(12, Math.max(1, cycleWeeks.value + delta))
}

function goBack() {
  uni.navigateBack()
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
    showPlanWriteError(err, '计划创建失败，请重试')
    console.error('[plan] create failed', err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="page-shell operation-page plan-create safe-bottom" :class="themeStore.themeClass">
    <AppHeader
      title="新建计划"
      subtitle="设置计划周期，再添加每周训练日"
      show-back
      @back="goBack"
    />
    <view class="glass-card create-card">
      <view class="field-label">计划名称</view>
      <input v-model="name" class="name-input" maxlength="30" placeholder="输入计划名称" />
      <view class="field-label cycle-label">计划周期</view>
      <view class="week-stepper">
        <button class="step-button" @tap="changeWeeks(-1)">−</button>
        <view class="week-value"
          ><strong class="week-value__number">{{ cycleWeeks }}</strong
          ><text class="week-value__unit">周</text></view
        >
        <button class="step-button" @tap="changeWeeks(1)">＋</button>
      </view>
      <view class="quick-row">
        <button
          v-for="week in quickWeeks"
          :key="week"
          class="quick-chip"
          :class="{ 'quick-chip--active': cycleWeeks === week }"
          @tap="cycleWeeks = week"
        >
          {{ week }} 周
        </button>
      </view>
      <view class="helper-text">计划会在设定周期结束后归档，不会自动无限循环。</view>
    </view>
    <view class="bottom-action">
      <PrimaryButton :disabled="!canSave || busy" @tap="save">{{
        busy ? '创建中' : '创建并添加训练日'
      }}</PrimaryButton>
    </view>
  </view>
  <MembershipRequiredModal />
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 28rpx 30rpx 180rpx;
}
.create-card {
  padding: 30rpx;
  border-radius: 28rpx;
}
.field-label {
  color: var(--app-text);
  font-size: 30rpx;
  font-weight: 800;
}
.cycle-label {
  margin-top: 42rpx;
}
.name-input {
  height: 94rpx;
  margin-top: 18rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 20rpx;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 30rpx;
}
.week-stepper {
  display: grid;
  grid-template-columns: 84rpx 1fr 84rpx;
  gap: 18rpx;
  align-items: center;
  margin-top: 20rpx;
}
.step-button {
  width: 84rpx;
  height: 84rpx;
  padding: 0;
  border: 1rpx solid rgba(255, 100, 24, 0.3);
  border-radius: 22rpx;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  font-size: 42rpx;
}
.week-value {
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-bg);
  color: var(--app-text-muted);
}
.week-value__number,
.week-value__unit {
  line-height: 1;
}
.week-value__number {
  color: var(--app-text);
  font-size: 48rpx;
}
.week-value__unit {
  padding-top: 6rpx;
  font-size: 26rpx;
}
.quick-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 20rpx;
}
.quick-chip {
  height: 70rpx;
  padding: 0;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-bg);
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.quick-chip--active {
  border-color: rgba(255, 100, 24, 0.36);
  background: var(--app-accent-soft);
  color: var(--app-accent);
}
.helper-text {
  margin-top: 28rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
}
.bottom-action {
  position: fixed;
  left: 30rpx;
  right: 30rpx;
  bottom: calc(env(safe-area-inset-bottom) + 24rpx);
  z-index: 5;
}
</style>
