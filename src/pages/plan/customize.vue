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
import type {
  RecommendedPlanIntroResponse,
  RecommendedPlanPersonalizationRequest,
  RecommendedPlanPreviewResponse
} from '@/api/plan'

const planStore = usePlanStore()
const themeStore = useThemeStore()
const planId = ref<number | null>(null)
const intro = ref<RecommendedPlanIntroResponse | null>(null)
const preview = ref<RecommendedPlanPreviewResponse | null>(null)
const loading = ref(false)
const previewing = ref(false)
const activating = ref(false)
const weeklyFrequency = ref(3)
const unavailableBodyParts = ref<string[]>(['NONE'])
const equipment = ref<RecommendedPlanPersonalizationRequest['equipment']>('GYM')
const durationMinutes = ref<20 | 35 | 50>(35)

const frequencyOptions = [2, 3, 4, 5]
const bodyPartOptions = [
  { label: '无不适', value: 'NONE' },
  { label: '肩', value: 'SHOULDER' },
  { label: '下背', value: 'LOWER_BACK' },
  { label: '膝', value: 'KNEE' },
  { label: '腕', value: 'WRIST' }
]
const equipmentOptions: Array<{
  label: string
  value: RecommendedPlanPersonalizationRequest['equipment']
}> = [
  { label: '健身房', value: 'GYM' },
  { label: '哑铃', value: 'DUMBBELL' },
  { label: '徒手', value: 'BODYWEIGHT' },
  { label: '先不确定', value: 'UNKNOWN' }
]
const durationOptions: Array<20 | 35 | 50> = [20, 35, 50]
const payload = computed<RecommendedPlanPersonalizationRequest>(() => ({
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
  await loadPreview()
})

async function loadIntro() {
  if (!planId.value || intro.value || loading.value) return
  loading.value = true
  try {
    intro.value = await planStore.getRecommendedIntro(planId.value)
    weeklyFrequency.value = Math.min(
      intro.value.maxWeeklyFrequency,
      Math.max(intro.value.minWeeklyFrequency, weeklyFrequency.value)
    )
  } catch (err) {
    uni.showToast({ title: '计划加载失败', icon: 'none' })
    console.error('[plan] recommended intro failed', err)
  } finally {
    loading.value = false
  }
}

async function loadPreview() {
  if (!planId.value || previewing.value) return
  previewing.value = true
  try {
    preview.value = await planStore.previewRecommended(planId.value, payload.value)
  } catch (err) {
    preview.value = null
    uni.showToast({ title: '预览生成失败', icon: 'none' })
    console.error('[plan] preview failed', err)
  } finally {
    previewing.value = false
  }
}

function toggleBodyPart(value: string) {
  if (value === 'NONE') {
    unavailableBodyParts.value = ['NONE']
    void loadPreview()
    return
  }
  const next = new Set(unavailableBodyParts.value.filter((item) => item !== 'NONE'))
  if (next.has(value)) next.delete(value)
  else next.add(value)
  unavailableBodyParts.value = next.size ? Array.from(next) : ['NONE']
  void loadPreview()
}

function setWeeklyFrequency(value: number) {
  weeklyFrequency.value = value
  void loadPreview()
}

function setEquipment(value: RecommendedPlanPersonalizationRequest['equipment']) {
  equipment.value = value
  void loadPreview()
}

function setDurationMinutes(value: 20 | 35 | 50) {
  durationMinutes.value = value
  void loadPreview()
}

async function activate() {
  if (!planId.value || activating.value) return
  activating.value = true
  try {
    await planStore.activateRecommended(planId.value, payload.value)
    const execution = await planStore.loadActiveExecution()
    const nextDay = execution?.days.find((day) => day.status === 'PENDING') || execution?.days[0]
    uni.showToast({ title: '已生成训练安排', icon: 'none' })
    uni.redirectTo({
      url: nextDay ? `${routes.planExecutionDay}?dayId=${nextDay.id}` : routes.planIndex
    })
  } catch (err) {
    uni.showToast({ title: '启用失败', icon: 'none' })
    console.error('[plan] activate recommended failed', err)
  } finally {
    activating.value = false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view
      class="page-shell secondary-page plan-customize safe-bottom"
      :class="themeStore.themeClass"
    >
      <AppHeader title="定制计划" :subtitle="intro?.name || '推荐计划'" show-back />

      <EmptyState
        v-if="!loading && !intro"
        icon="!"
        title="计划不可用"
        description="请返回后重新选择推荐计划。"
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
          <view class="plan-customize__label">暂时不适合练</view>
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

        <view class="section-heading plan-customize__heading">
          <view>
            <view class="section-title">预览安排</view>
            <view class="plan-customize__sub">{{
              preview?.replacementSummary || '按你的选择生成训练日'
            }}</view>
          </view>
        </view>

        <view v-if="previewing" class="plan-customize__state">生成中...</view>
        <view v-else class="plan-customize__days">
          <view
            v-for="day in preview?.days || []"
            :key="`${day.weekIndex}-${day.dayOfWeek}`"
            class="glass-card plan-customize__day"
          >
            <view class="plan-customize__day-title"
              >第 {{ day.weekIndex }} 周 · {{ day.title }}</view
            >
            <view class="plan-customize__day-meta">{{ day.items.length }} 个动作</view>
            <view
              v-for="item in day.items"
              :key="`${day.title}-${item.sortOrder}`"
              class="plan-customize__exercise"
            >
              <text>{{ item.exerciseName }}</text>
              <text>{{ item.targetSets || 1 }} 组</text>
            </view>
          </view>
        </view>

        <view v-if="preview?.warnings?.length" class="plan-customize__warnings">
          <view
            v-for="warning in preview.warnings"
            :key="warning"
            class="plan-customize__warning"
            >{{ warning }}</view
          >
        </view>

        <PrimaryButton class="plan-customize__submit" :loading="activating" @tap="activate">
          生成并启用
        </PrimaryButton>
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

  &__heading {
    margin-top: 30rpx;
  }

  &__sub,
  &__day-meta,
  &__state,
  &__warning {
    color: var(--app-text-muted);
    font-size: 23rpx;
  }

  &__day {
    margin-top: 18rpx;
    padding: 22rpx;
  }

  &__day-title {
    color: var(--app-text-main);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__exercise {
    min-height: 54rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
    color: var(--app-text-main);
    font-size: 24rpx;
  }

  &__warnings {
    margin-top: 18rpx;
  }

  &__warning {
    margin-top: 8rpx;
  }

  &__submit {
    margin-top: 28rpx;
  }
}
</style>
