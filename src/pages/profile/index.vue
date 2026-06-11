<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { clearToken, getToken } from '@/api/http'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { emitAuthChanged } from '@/utils/auth-events'
import { routes } from '@/utils/navigation'
import CultivationFigure from '@/components/cultivation-figure/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import { useProfileStore } from '@/stores/profile'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { formatCompactWeight } from '@/utils/unit'
import { fetchCultivationProfile, type CultivationProfileResponse } from '@/api/cultivation'

const profileStore = useProfileStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const authChecking = ref(true)
const cultivation = ref<CultivationProfileResponse | null>(null)
const showCultivationDetail = ref(false)
let authFlowRunning = false
let suppressNextAuthUntil = 0
const weightUnit = computed(() => profileStore.unit)
const profileSubtitle = computed(() => {
  const goal = profileStore.trainingGoal || '目标未设'
  const level = profileStore.experienceLevel || '经验未设'
  return `${goal} · ${level}`
})
const cultivationTitle = computed(() =>
  cultivation.value ? `${cultivation.value.realmName} · ${cultivation.value.stageName}` : '炼体期 · 一重'
)
const cultivationProgressText = computed(() =>
  cultivation.value
    ? `${cultivation.value.currentLevelExp}/${cultivation.value.nextLevelExp}`
    : '0/80'
)
const cultivationProgressStyle = computed(() => ({
  width: `${Math.max(0, Math.min(100, cultivation.value?.progressPercent || 0))}%`
}))
const cultivationThemeColor = computed(() => cultivation.value?.themeColor || '#ff6a2a')
const cultivationAccentColor = computed(() => cultivation.value?.accentColor || '#b73518')
const cultivationVisualKey = computed(() => cultivation.value?.visualKey || 'body')
const cultivationCardStyle = computed(() => ({
  '--cultivation-theme': cultivationThemeColor.value,
  '--cultivation-accent': cultivationAccentColor.value
}))
const cultivationNextExp = computed(() => {
  if (!cultivation.value) return '--'
  return Math.max(0, cultivation.value.nextLevelExp - cultivation.value.currentLevelExp)
})
const cultivationAuraText = computed(() => cultivation.value?.auraName || '筋骨初成')
const realmPreviewItems = [
  {
    label: '炼体期',
    visualKey: 'body',
    themeColor: '#ff6a2a',
    accentColor: '#b73518',
    aura: '筋骨初成'
  },
  {
    label: '练气期',
    visualKey: 'qi',
    themeColor: '#35d9ff',
    accentColor: '#1188ff',
    aura: '吐纳成息'
  },
  {
    label: '筑基期',
    visualKey: 'foundation',
    themeColor: '#ffd45a',
    accentColor: '#d89a18',
    aura: '根基稳固'
  },
  {
    label: '结丹期',
    visualKey: 'core',
    themeColor: '#b86cff',
    accentColor: '#ffbf58',
    aura: '丹核初凝'
  },
  {
    label: '元婴期',
    visualKey: 'spirit',
    themeColor: '#9adfff',
    accentColor: '#62f0ff',
    aura: '灵影初现'
  },
  {
    label: '化神期',
    visualKey: 'deity',
    themeColor: '#fff3b0',
    accentColor: '#ffffff',
    aura: '神识通明'
  }
]
const currentRealmIndex = computed(() => {
  const index = realmPreviewItems.findIndex((item) => item.visualKey === cultivationVisualKey.value)
  return index >= 0 ? index : 0
})
const cultivationDescription = computed(() => {
  const realm = cultivation.value?.realmName || '炼体期'
  const aura = cultivationAuraText.value
  return `${realm}阶段重点是稳定训练节奏，持续积累修为。${aura}后，下一阶段会逐步解锁更高层次的成长感。`
})
const profileStats = computed(() => [
  { icon: '🔥', value: `${profileStore.currentStreakDays} 天`, label: '连续训练' },
  { icon: '🏋', value: `${profileStore.totalSessions} 次`, label: '累计训练' },
  {
    icon: '⚡',
    value: `${formatCompactWeight(profileStore.totalVolumeKg, weightUnit.value)} ${weightUnit.value}`,
    label: '累计容量'
  }
])

const quickItems = [
  {
    label: '编辑资料',
    sub: '个人信息与训练方向',
    path: routes.profileEdit,
    icon: '👤',
    tone: 'cyan'
  },
  {
    label: '身体指标',
    sub: '体脂、围度和心率记录',
    path: routes.profileBodyMetrics,
    icon: '◎',
    tone: 'orange'
  },
  {
    label: '历史记录',
    sub: '浏览训练明细',
    path: `${routes.workoutCalendar}?mode=records`,
    icon: '🕘',
    tone: 'orange'
  },
  {
    label: '模板管理',
    sub: '维护训练模板',
    path: routes.templateManager,
    icon: '🎸',
    tone: 'violet'
  }
]

const serviceItems = [
  {
    label: '会员中心',
    sub: '查看试用期、套餐和会员权益',
    path: routes.membership,
    icon: '👑',
    tone: 'gold'
  },
  { label: '我的收藏', sub: '常用动作收藏', path: routes.favorites, icon: '⭐', tone: 'gold' },
  { label: '设置', sub: '单位、休息与应用偏好', path: routes.settings, icon: '⚙', tone: 'cyan' },
  { label: '关于', sub: '版本信息与相关协议', path: routes.about, icon: 'ⓘ', tone: 'orange' }
]

onShow(async () => {
  if (Date.now() < suppressNextAuthUntil) return
  if (authFlowRunning) return
  authFlowRunning = true
  authChecking.value = true
  const ok = await ensureFeatureAuth('个人信息')
  if (!ok) {
    // Closing the login page briefly re-triggers this tab's onShow before switchTab finishes.
    suppressNextAuthUntil = Date.now() + 1200
    authChecking.value = false
    authFlowRunning = false
    uni.switchTab({ url: routes.home })
    return
  }
  await Promise.all([profileStore.refreshProfile(), profileStore.refreshSummary(), refreshCultivation()])
  authChecking.value = false
  authFlowRunning = false
})

async function refreshCultivation() {
  try {
    cultivation.value = await fetchCultivationProfile()
  } catch (err) {
    cultivation.value = null
    console.error('[cultivation] profile fetch failed', err)
  }
}

function openPage(path: string) {
  uni.navigateTo({ url: path })
}

function openCultivationDetail() {
  showCultivationDetail.value = true
}

function closeCultivationDetail() {
  showCultivationDetail.value = false
}

function goTrainFromCultivation() {
  showCultivationDetail.value = false
  uni.switchTab({ url: routes.home })
}

function goAnalysisFromCultivation() {
  showCultivationDetail.value = false
  uni.navigateTo({ url: routes.volumeTrend })
}

async function openDraftFab() {
  workoutStore.refreshDraftState()
  const action = await draftPromptStore.open()
  if (action === 'continue') {
    if (workoutStore.restoreDraft()) {
      uni.navigateTo({ url: routes.workoutActive })
    }
  }
  if (action === 'discard') {
    workoutStore.discardWorkout()
  }
}

function logout() {
  uni.showModal({
    title: '退出登录？',
    content: '退出后将清除当前登录状态，训练记录和收藏需要重新登录后查看。',
    confirmText: '退出',
    confirmColor: '#ff6b4a',
    success: (res) => {
      if (!res.confirm) return
      clearToken()
      profileStore.resetProfile()
      emitAuthChanged()
      uni.showToast({ title: '已退出登录', icon: 'none' })
      uni.switchTab({ url: routes.home })
    }
  })
}

function getToneBg(tone?: string) {
  switch (tone) {
    case 'cyan':
      return 'rgba(80, 200, 255, 0.15)'
    case 'violet':
      return 'rgba(200, 80, 255, 0.15)'
    case 'gold':
      return 'rgba(255, 200, 80, 0.15)'
    default:
      return 'rgba(255, 80, 30, 0.15)'
  }
}

function getRealmItemStyle(item: (typeof realmPreviewItems)[number]) {
  return {
    '--cultivation-theme': item.themeColor,
    '--cultivation-accent': item.accentColor
  }
}

function isRealmCurrent(visualKey: string) {
  return cultivationVisualKey.value === visualKey
}

function isRealmUnlocked(index: number) {
  return index <= currentRealmIndex.value
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell tab-page safe-bottom">
      <view v-if="authChecking && !getToken()" class="profile__auth-state muted">
        正在打开登录授权...
      </view>
      <template v-else>
        <view class="profile__hero" :style="cultivationCardStyle">
          <view class="profile__hero-top">
            <image
              class="profile__avatar"
              :src="profileStore.avatarDisplayUrl || '/static/app-logo.png'"
              mode="aspectFill"
            />
            <view class="profile__info">
              <view class="title-lg">{{ profileStore.nickname }}</view>
              <view class="profile__profile-sub">{{ profileSubtitle }}</view>
            </view>
            <view class="profile__settings btn-press" @tap="openPage(routes.settings)">⚙</view>
          </view>

          <view
            class="profile__cultivation btn-press"
            @tap="openCultivationDetail"
          >
            <view class="profile__cultivation-main">
              <view class="profile__cultivation-label">当前境界</view>
              <view class="profile__cultivation-title">{{ cultivationTitle }}</view>
              <view class="profile__cultivation-aura">{{ cultivationAuraText }}</view>
            </view>
            <view class="profile__cultivation-progress">
              <view class="profile__cultivation-value">{{ cultivationProgressText }}</view>
              <view class="profile__cultivation-track">
                <view class="profile__cultivation-bar" :style="cultivationProgressStyle" />
              </view>
              <view class="profile__cultivation-next">还差 {{ cultivationNextExp }} 修为</view>
            </view>
          </view>

          <view class="profile__stats">
            <view v-for="item in profileStats" :key="item.label" class="profile__stat">
              <view class="profile__stat-icon">{{ item.icon }}</view>
              <view class="profile__stat-value">{{ item.value }}</view>
              <view class="muted">{{ item.label }}</view>
            </view>
          </view>
        </view>

        <view class="profile__section-head">
          <view class="profile__section-title">训练与记录</view>
        </view>

        <view class="profile__quick-grid">
          <view
            v-for="item in quickItems"
            :key="item.label"
            class="profile__quick-item btn-press"
            @tap="openPage(item.path)"
          >
            <view class="profile__quick-icon" :style="{ background: getToneBg(item.tone) }">{{
              item.icon
            }}</view>
            <view class="profile__quick-title">{{ item.label }}</view>
            <view class="profile__quick-sub">{{ item.sub }}</view>
          </view>
        </view>

        <view class="profile__section-head profile__section-head--services">
          <view class="profile__section-title">更多服务</view>
        </view>

        <view class="profile__menu">
          <view
            v-for="item in serviceItems"
            :key="item.label"
            class="profile__menu-item btn-press"
            @tap="openPage(item.path)"
          >
            <view class="profile__menu-icon" :style="{ background: getToneBg(item.tone) }">{{ item.icon }}</view>
            <view class="profile__menu-body">
              <view class="profile__menu-title">{{ item.label }}</view>
              <view class="profile__menu-sub">{{ item.sub }}</view>
            </view>
            <view class="profile__menu-arrow">›</view>
          </view>
        </view>

        <view class="profile__logout btn-press" @tap="logout">退出登录</view>
      </template>
    </view>
  </scroll-view>
  <view v-if="showCultivationDetail" class="profile__cultivation-overlay" @tap="closeCultivationDetail">
    <view class="profile__cultivation-sheet" :style="cultivationCardStyle" @tap.stop>
      <view class="profile__cultivation-handle" />
      <view class="profile__cultivation-sheet-top">
        <view class="profile__cultivation-sheet-heading">用户等级详解</view>
        <view class="profile__cultivation-close btn-press" @tap="closeCultivationDetail">×</view>
      </view>

      <view class="profile__realm-detail-card">
        <view class="profile__realm-title">
          {{ cultivationTitle }}
          <text class="profile__realm-aura">（{{ cultivationAuraText }}）</text>
        </view>
        <CultivationFigure
          immersive
          :visual-key="cultivationVisualKey"
          :theme-color="cultivationThemeColor"
          :accent-color="cultivationAccentColor"
        />
        <view class="profile__cultivation-detail-row profile__realm-progress-row">
          <text>{{ cultivation?.realmName || '炼体期' }}</text>
          <text>{{ cultivationProgressText }}</text>
        </view>
        <view class="profile__cultivation-track profile__cultivation-track--detail">
          <view class="profile__cultivation-bar" :style="cultivationProgressStyle" />
        </view>
        <view class="profile__cultivation-detail-copy">{{ cultivationDescription }}</view>
        <view class="profile__cultivation-detail-copy">
          距离下一阶段还差 {{ cultivationNextExp }} 修为 · 连续有效训练
          {{ cultivation?.currentStreakDays || 0 }} 天
        </view>
      </view>

      <scroll-view scroll-x class="profile__realm-list" :show-scrollbar="false">
        <view class="profile__realm-list-inner">
          <view
            v-for="(item, index) in realmPreviewItems"
            :key="item.visualKey"
            class="profile__realm-item"
            :class="{
              'profile__realm-item--current': isRealmCurrent(item.visualKey),
              'profile__realm-item--locked': !isRealmUnlocked(index)
            }"
            :style="getRealmItemStyle(item)"
          >
            <CultivationFigure
              thumbnail
              :visual-key="item.visualKey"
              :theme-color="item.themeColor"
              :accent-color="item.accentColor"
              :muted="!isRealmUnlocked(index)"
            />
            <view class="profile__realm-item-name">{{ item.label }}</view>
            <view class="profile__realm-item-state">
              {{ isRealmCurrent(item.visualKey) ? '当前' : isRealmUnlocked(index) ? item.aura : '未解锁' }}
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="profile__cultivation-rules">
        <view class="profile__cultivation-rule">满 30 分钟的训练才会增加修为</view>
        <view class="profile__cultivation-rule">每天最多结算一次修为</view>
        <view class="profile__cultivation-rule">满 60 分钟和连续训练有少量加成</view>
      </view>

      <view class="profile__cultivation-actions">
        <view class="gradient-fire profile__cultivation-action btn-press" @tap="goTrainFromCultivation">
          去训练
        </view>
        <view class="glass-card profile__cultivation-action btn-press" @tap="goAnalysisFromCultivation">
          查看训练分析
        </view>
      </view>
    </view>
  </view>
  <WorkoutDraftFab :visible="!showCultivationDetail" @open="openDraftFab" />
  <WorkoutDraftPrompt />
</template>

<style lang="scss" scoped>
.profile {
  &__auth-state {
    min-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
  }

  &__hero {
    --cultivation-theme: #ff6a2a;
    --cultivation-accent: #b73518;
    position: relative;
    padding: 10rpx 0 0;
  }

  &__hero-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 0 4rpx;
  }

  &__avatar {
    width: 112rpx;
    height: 112rpx;
    border-radius: 32rpx;
    border: 2rpx solid rgba(255, 210, 132, 0.42);
    box-shadow:
      0 0 0 8rpx rgba(255, 106, 42, 0.08),
      0 0 36rpx rgba(255, 106, 42, 0.42);
    background: rgba(255, 80, 30, 0.12);
    flex-shrink: 0;
  }

  &__settings {
    width: 68rpx;
    height: 68rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #c9c9d5;
    background: rgba(255, 255, 255, 0.055);
    border: 1rpx solid rgba(255, 255, 255, 0.08);
    font-size: 27rpx;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__profile-sub {
    margin-top: 8rpx;
    color: #a0a0b4;
    font-size: 24rpx;
    line-height: 1.4;
  }

  &__cultivation {
    --cultivation-theme: #ff6a2a;
    --cultivation-accent: #b73518;
    position: relative;
    z-index: 1;
    margin-top: 22rpx;
    padding: 22rpx 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24rpx;
    border-radius: 26rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.085);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.035)),
      radial-gradient(circle at 54% 110%, var(--cultivation-theme), transparent 48%);
    box-shadow:
      inset 0 0 28rpx rgba(255, 255, 255, 0.035),
      0 18rpx 46rpx rgba(0, 0, 0, 0.22);
  }

  &__cultivation-main {
    min-width: 0;
  }

  &__cultivation-label {
    color: var(--cultivation-theme);
    font-size: 20rpx;
    font-weight: 900;
  }

  &__cultivation-title {
    margin-top: 8rpx;
    color: #f5f5fa;
    font-size: 32rpx;
    font-weight: 900;
    text-shadow: 0 0 22rpx var(--cultivation-theme);
  }

  &__cultivation-aura {
    margin-top: 8rpx;
    color: #a8a8b8;
    font-size: 21rpx;
    font-weight: 800;
  }

  &__cultivation-progress {
    width: 220rpx;
    flex-shrink: 0;
  }

  &__cultivation-value {
    color: #b8b8c8;
    font-size: 22rpx;
    font-weight: 800;
    text-align: right;
  }

  &__cultivation-next {
    margin-top: 9rpx;
    color: #858598;
    font-size: 19rpx;
    text-align: right;
  }

  &__cultivation-track {
    margin-top: 12rpx;
    height: 16rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.09);
    overflow: hidden;
    box-shadow: inset 0 0 12rpx rgba(0, 0, 0, 0.45);
  }

  &__cultivation-bar {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--cultivation-theme), var(--cultivation-accent));
    box-shadow: 0 0 26rpx var(--cultivation-theme);
  }

  &__cultivation-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.72);
    animation: profile-fade-in 0.18s ease-out;
  }

  &__cultivation-sheet {
    --cultivation-theme: #ff6a2a;
    --cultivation-accent: #b73518;
    width: 100%;
    max-height: 90vh;
    padding: 18rpx 30rpx calc(env(safe-area-inset-bottom) + 32rpx);
    border-radius: 40rpx 40rpx 0 0;
    background:
      radial-gradient(circle at 50% 14%, var(--cultivation-theme), transparent 44%),
      radial-gradient(circle at 50% 58%, rgba(255, 255, 255, 0.06), transparent 34%),
      rgba(16, 16, 24, 0.98);
    border: 1rpx solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 -34rpx 100rpx rgba(0, 0, 0, 0.56);
    overflow-y: auto;
    animation: profile-sheet-in 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  &__cultivation-handle {
    width: 80rpx;
    height: 8rpx;
    margin: 0 auto 22rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.2);
  }

  &__cultivation-sheet-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24rpx;
  }

  &__cultivation-sheet-heading {
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 900;
    letter-spacing: 0;
  }

  &__cultivation-sheet-title {
    margin-top: 8rpx;
    color: #f5f5fa;
    font-size: 38rpx;
    font-weight: 900;
  }

  &__cultivation-sheet-sub {
    margin-top: 8rpx;
    color: var(--cultivation-theme);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__cultivation-close {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34rpx;
    font-weight: 900;
  }

  &__realm-detail-card {
    position: relative;
    margin-top: 20rpx;
    padding: 0 0 28rpx;
    border-radius: 34rpx;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 26%, var(--cultivation-theme), transparent 44%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(12, 12, 18, 0.94));
    border: 1rpx solid var(--cultivation-theme);
    box-shadow:
      0 0 34rpx rgba(255, 106, 42, 0.18),
      inset 0 0 40rpx rgba(255, 255, 255, 0.03);

    :deep(.cultivation-figure--immersive) {
      width: 100%;
      height: 520rpx;
      margin: 0 0 -18rpx;
      background:
        radial-gradient(circle at 50% 38%, var(--cultivation-theme), transparent 52%),
        transparent;
    }

    :deep(.cultivation-figure--immersive .cultivation-figure__image) {
      inset: -42rpx 0 -98rpx;
      width: 100%;
      height: calc(100% + 140rpx);
      opacity: 0.98;
    }

    :deep(.cultivation-figure--immersive .cultivation-figure__fade--top) {
      height: 50rpx;
      background: linear-gradient(180deg, rgba(12, 12, 18, 0.38), transparent);
    }

    :deep(.cultivation-figure--immersive .cultivation-figure__fade--bottom) {
      height: 150rpx;
      background: linear-gradient(0deg, rgba(12, 12, 18, 0.96), transparent);
    }

    :deep(.cultivation-figure--immersive .cultivation-figure__fade--left),
    :deep(.cultivation-figure--immersive .cultivation-figure__fade--right) {
      width: 0;
    }
  }

  &__realm-title {
    position: relative;
    z-index: 2;
    margin: 0;
    padding: 22rpx 20rpx 24rpx;
    border-radius: 32rpx 32rpx 0 0;
    background:
      linear-gradient(180deg, rgba(24, 25, 29, 0.94), rgba(10, 10, 14, 0.9));
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
    color: #f5f5fa;
    text-align: center;
    font-size: 36rpx;
    font-weight: 900;
    box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.28);
  }

  &__realm-aura {
    color: var(--cultivation-theme);
  }

  &__realm-progress-row {
    position: relative;
    z-index: 2;
    margin: 4rpx 24rpx 0;

    text {
      min-width: 0;
    }

    text:first-child {
      flex: 1;
    }

    text:last-child {
      flex-shrink: 0;
      padding-left: 20rpx;
    }
  }

  &__cultivation-detail-card {
    position: relative;
    z-index: 2;
    margin-top: 0;
    padding: 24rpx;
    border-radius: 28rpx;
    background: rgba(255, 255, 255, 0.065);
    border: 1rpx solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 -22rpx 72rpx rgba(0, 0, 0, 0.32);
  }

  &__cultivation-detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #f5f5fa;
    font-size: 24rpx;
    font-weight: 900;
  }

  &__cultivation-track--detail {
    margin: 16rpx 24rpx 0;
    height: 14rpx;
  }

  &__cultivation-detail-copy {
    margin: 16rpx 24rpx 0;
    color: #a5a5b8;
    font-size: 23rpx;
    line-height: 1.5;
  }

  &__realm-list {
    margin-top: 22rpx;
    width: 100%;
    white-space: nowrap;
  }

  &__realm-list-inner {
    display: inline-flex;
    gap: 16rpx;
    padding: 0 4rpx;
  }

  &__realm-item {
    --cultivation-theme: #ff6a2a;
    --cultivation-accent: #b73518;
    width: 146rpx;
    padding: 14rpx 12rpx 16rpx;
    border-radius: 26rpx;
    background:
      radial-gradient(circle at 50% 0%, var(--cultivation-theme), transparent 44%),
      rgba(255, 255, 255, 0.07);
    border: 1rpx solid rgba(255, 255, 255, 0.1);
    text-align: center;
    opacity: 0.74;
  }

  &__realm-item--current {
    opacity: 1;
    border-color: var(--cultivation-theme);
    box-shadow: 0 0 24rpx var(--cultivation-theme);
  }

  &__realm-item--locked {
    filter: grayscale(0.85);
  }

  &__realm-item-name {
    margin-top: 10rpx;
    color: #f5f5fa;
    font-size: 22rpx;
    font-weight: 900;
  }

  &__realm-item-state {
    margin-top: 6rpx;
    color: var(--cultivation-theme);
    font-size: 18rpx;
    font-weight: 800;
  }

  &__cultivation-rules {
    margin-top: 18rpx;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__cultivation-rule {
    padding: 18rpx 20rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.045);
    color: #b8b8c8;
    font-size: 23rpx;
  }

  &__cultivation-actions {
    margin-top: 22rpx;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16rpx;
  }

  &__cultivation-action {
    min-height: 86rpx;
    border-radius: 26rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 26rpx;
    font-weight: 900;
  }

  &__stats {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 16rpx;
    overflow: hidden;
    border-radius: 24rpx;
    background: rgba(255, 255, 255, 0.035);
    border: 1rpx solid rgba(255, 255, 255, 0.075);
  }

  &__stat {
    position: relative;
    padding: 20rpx 8rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7rpx;

    & + &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 22rpx;
      bottom: 22rpx;
      width: 1rpx;
      background: rgba(255, 255, 255, 0.07);
    }
  }

  &__stat-icon {
    font-size: 24rpx;
  }

  &__stat-value {
    color: #f5f5fa;
    font-size: 25rpx;
    font-weight: 900;
  }

  &__section-head {
    margin: 32rpx 0 16rpx;

    &--services {
      margin-top: 30rpx;
    }
  }

  &__section-title {
    color: #f5f5fa;
    font-size: 29rpx;
    font-weight: 900;
  }

  &__quick-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14rpx;
  }

  &__quick-item {
    min-height: 164rpx;
    padding: 22rpx;
    border-radius: 24rpx;
    background:
      linear-gradient(155deg, rgba(255, 255, 255, 0.052), rgba(255, 255, 255, 0.025));
    border: 1rpx solid rgba(255, 255, 255, 0.075);
  }

  &__quick-icon {
    width: 58rpx;
    height: 58rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 25rpx;
  }

  &__quick-title {
    margin-top: 16rpx;
    color: #f5f5fa;
    font-size: 26rpx;
    font-weight: 900;
  }

  &__quick-sub {
    margin-top: 7rpx;
    color: #858598;
    font-size: 20rpx;
    line-height: 1.35;
  }

  &__menu {
    overflow: hidden;
    border-radius: 24rpx;
    background: rgba(255, 255, 255, 0.032);
    border: 1rpx solid rgba(255, 255, 255, 0.07);
  }

  &__menu-item {
    display: flex;
    align-items: center;
    gap: 18rpx;
    min-height: 104rpx;
    padding: 18rpx 22rpx;

    & + & {
      border-top: 1rpx solid rgba(255, 255, 255, 0.065);
    }
  }

  &__menu-icon {
    width: 56rpx;
    height: 56rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__menu-body {
    flex: 1;
  }

  &__menu-title {
    color: #f5f5fa;
    font-size: 25rpx;
    font-weight: 900;
  }

  &__menu-sub {
    margin-top: 5rpx;
    color: #828296;
    font-size: 20rpx;
  }

  &__menu-arrow {
    color: #828296;
    font-size: 28rpx;
  }

  &__logout {
    margin-top: 26rpx;
    padding: 22rpx 24rpx;
    color: #ff6b4a;
    text-align: center;
    font-size: 24rpx;
    font-weight: 800;
  }
}

@keyframes profile-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes profile-sheet-in {
  from {
    opacity: 0;
    transform: translateY(60rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
