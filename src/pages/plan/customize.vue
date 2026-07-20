<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import { usePlanStore } from '@/stores/plan'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import type { SystemPlanDetailResponse, SystemPlanCustomizationRequest } from '@/api/plan'

const planStore = usePlanStore()
const themeStore = useThemeStore()
const planId = ref<number | null>(null)
const detail = ref<SystemPlanDetailResponse | null>(null)
const loading = ref(false)
const weeklyFrequency = ref(3)
const unavailableBodyParts = ref<string[]>(['NONE'])
const equipment = ref<SystemPlanCustomizationRequest['equipment']>('GYM')
const durationMinutes = ref<20 | 35 | 50>(35)

const frequencyOptions = computed(() => {
  if (!detail.value) return []
  const values: number[] = []
  for (
    let value = detail.value.minWeeklyFrequency;
    value <= detail.value.maxWeeklyFrequency;
    value += 1
  ) {
    values.push(value)
  }
  return values
})
const bodyPartOptions = [
  { label: '无不适', value: 'NONE' },
  { label: '肩', value: 'SHOULDER' },
  { label: '下背', value: 'LOWER_BACK' },
  { label: '膝', value: 'KNEE' },
  { label: '腕', value: 'WRIST' }
]
const equipmentLabels: Record<SystemPlanCustomizationRequest['equipment'], string> = {
  GYM: '健身房',
  DUMBBELL: '哑铃',
  BODYWEIGHT: '徒手'
}
const equipmentOptions = computed(() =>
  (detail.value?.supportedEquipment || []).map((value) => ({
    label: equipmentLabels[value],
    value
  }))
)
const durationOptions = computed(() => detail.value?.supportedDurations || [])
const payload = computed<SystemPlanCustomizationRequest>(() => ({
  weeklyFrequency: weeklyFrequency.value,
  unavailableBodyParts: unavailableBodyParts.value,
  equipment: equipment.value,
  durationMinutes: durationMinutes.value
}))
onLoad((options) => {
  const id = Number(options?.id)
  planId.value = Number.isFinite(id) && id > 0 ? id : null
})

onShow(async () => {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await loadIntro()
})

async function loadIntro() {
  if (!planId.value || detail.value || loading.value) return
  loading.value = true
  try {
    detail.value = await planStore.getSystemPlanDetail(planId.value)
    weeklyFrequency.value = detail.value.defaultWeeklyFrequency
    equipment.value = detail.value.defaultEquipment
    durationMinutes.value = detail.value.defaultDurationMinutes
  } catch (err) {
    uni.showToast({ title: '计划加载失败', icon: 'none' })
    console.error('[plan] system plan detail failed', err)
  } finally {
    loading.value = false
  }
}

function toggleBodyPart(value: string) {
  if (value === 'NONE') {
    unavailableBodyParts.value = ['NONE']
    return
  }
  const next = new Set(unavailableBodyParts.value.filter((item) => item !== 'NONE'))
  if (next.has(value)) next.delete(value)
  else next.add(value)
  unavailableBodyParts.value = next.size ? Array.from(next) : ['NONE']
}

function setWeeklyFrequency(value: number) {
  weeklyFrequency.value = value
}

function setEquipment(value: SystemPlanCustomizationRequest['equipment']) {
  equipment.value = value
}

function setDurationMinutes(value: 20 | 35 | 50) {
  durationMinutes.value = value
}

function generatePlan() {
  if (!planId.value) return
  const query = [
    `id=${planId.value}`,
    `weeklyFrequency=${weeklyFrequency.value}`,
    `unavailableBodyParts=${encodeURIComponent(unavailableBodyParts.value.join(','))}`,
    `equipment=${equipment.value}`,
    `durationMinutes=${durationMinutes.value}`
  ].join('&')
  uni.navigateTo({ url: `${routes.planCustomizePreview}?${query}` })
}

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: routes.planIndex })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view
      class="page-shell secondary-page plan-customize safe-bottom"
      :class="themeStore.themeClass"
    >
      <AppHeader
        title="设置训练安排"
        :subtitle="detail?.name || '系统计划'"
        show-back
        @back="goBack"
      />

      <EmptyState
        v-if="!loading && !detail"
        icon="!"
        title="计划不可用"
        description="请返回后重新选择系统计划。"
      />

      <template v-else>
        <view class="glass-card plan-customize__panel">
          <view class="plan-customize__label">每周训练</view>
          <view class="plan-customize__chips">
            <view
              v-for="item in frequencyOptions"
              :key="item"
              class="plan-customize__chip btn-press"
              :class="{ 'plan-customize__chip--active': weeklyFrequency === item }"
              @tap="setWeeklyFrequency(item)"
            >
              {{ item }} 练
            </view>
          </view>
        </view>

        <view class="glass-card plan-customize__panel">
          <view class="plan-customize__label">需要避开的部位</view>
          <view class="plan-customize__chips">
            <view
              v-for="item in bodyPartOptions"
              :key="item.value"
              class="plan-customize__chip btn-press"
              :class="{ 'plan-customize__chip--active': unavailableBodyParts.includes(item.value) }"
              @tap="toggleBodyPart(item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>

        <view class="glass-card plan-customize__panel">
          <view class="plan-customize__label">器械条件</view>
          <view class="plan-customize__chips">
            <view
              v-for="item in equipmentOptions"
              :key="item.value"
              class="plan-customize__chip btn-press"
              :class="{ 'plan-customize__chip--active': equipment === item.value }"
              @tap="setEquipment(item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>

        <view class="glass-card plan-customize__panel">
          <view class="plan-customize__label">单次时长</view>
          <view class="plan-customize__chips">
            <view
              v-for="item in durationOptions"
              :key="item"
              class="plan-customize__chip btn-press"
              :class="{ 'plan-customize__chip--active': durationMinutes === item }"
              @tap="setDurationMinutes(item)"
            >
              {{ item }} min
            </view>
          </view>
        </view>

        <view class="plan-customize__hint">
          <view class="plan-customize__hint-title">下一步生成完整安排</view>
          <view class="plan-customize__hint-sub">
            生成后可按周查看训练日、动作列表和替换说明，再决定是否启用。
          </view>
        </view>

        <PrimaryButton class="plan-customize__submit" @tap="generatePlan">预览安排</PrimaryButton>
      </template>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.plan-customize {
  &__panel {
    margin-top: 20rpx;
    padding: 24rpx;
  }

  &__label {
    margin-bottom: 18rpx;
    color: var(--app-text-main);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 14rpx;
  }

  &__chip {
    min-height: 56rpx;
    padding: 0 22rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.78);
    color: var(--app-text-main);
    font-size: 24rpx;
    font-weight: 800;
  }

  &__chip--active {
    background: #ff6418;
    color: #fff;
  }

  &__hint {
    margin-top: 28rpx;
    padding: 26rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 30rpx;
    background: rgba(255, 255, 255, 0.82);
  }

  &__hint-title {
    color: var(--app-text-main);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__hint-sub {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__submit {
    margin-top: 28rpx;
  }
}
</style>
