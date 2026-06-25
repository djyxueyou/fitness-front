<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import {
  fetchLatestBodyMetrics,
  resolveAvatarUrl,
  type BodyMetricResponse,
  uploadAvatar
} from '@/api/user'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'

const profileStore = useProfileStore()
const themeStore = useThemeStore()
const saving = ref(false)
const nickname = ref('')
const avatarUrl = ref('')
const avatarPreviewUrl = ref('')
const avatarUploading = ref(false)
const heightInput = ref('')
const goal = ref('')
const level = ref('')
const bodyMetrics = ref<BodyMetricResponse[]>([])
const synced = ref(false)
const navigating = ref(false)
const pendingNavigation = ref<{ title: string; content: string; url: string } | null>(null)

const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const MIN_NICKNAME_LENGTH = 2
const MAX_NICKNAME_LENGTH = 20
const goals = ['增肌', '减脂', '力量', '塑形', '健康']
const levels = ['新手', '进阶', '熟练']

const displayWeight = computed(() =>
  profileStore.currentWeightKg ? `${profileStore.currentWeightKg.toFixed(1)} kg` : '未记录'
)
const formDirty = computed(() => {
  const savedHeight = profileStore.heightCm ? String(profileStore.heightCm) : ''
  return (
    nickname.value !== profileStore.nickname ||
    avatarUrl.value !== profileStore.avatarUrl ||
    heightInput.value !== savedHeight ||
    goal.value !== profileStore.trainingGoal ||
    level.value !== profileStore.experienceLevel
  )
})

onShow(async () => {
  const ok = await ensureFeatureAuth('编辑资料')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  if (!synced.value || !formDirty.value) {
    await profileStore.refreshProfile()
    syncForm()
    synced.value = true
  }
  await loadBodyMetrics()
})

function syncForm() {
  nickname.value = profileStore.nickname
  avatarUrl.value = profileStore.avatarUrl
  avatarPreviewUrl.value = resolveAvatarUrl(profileStore.avatarUrl)
  heightInput.value = profileStore.heightCm ? String(profileStore.heightCm) : ''
  goal.value = profileStore.trainingGoal
  level.value = profileStore.experienceLevel
}

async function loadBodyMetrics() {
  try {
    bodyMetrics.value = await fetchLatestBodyMetrics()
  } catch (err) {
    console.error('[profile-edit] body metrics refresh failed', err)
  }
}

function goBack() {
  uni.navigateBack()
}

function selectGoal(value: string) {
  goal.value = goal.value === value ? '' : value
}

function selectLevel(value: string) {
  level.value = level.value === value ? '' : value
}

function parseOptionalNumber(value: string, min: number, max: number, label: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label}需在 ${min}-${max} 之间`)
  }
  return Number(parsed.toFixed(2))
}

async function save(navigateAfterSave = true) {
  if (saving.value) return false
  const cleanName = nickname.value.trim()
  if (!cleanName) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return false
  }
  if (cleanName.length < MIN_NICKNAME_LENGTH) {
    uni.showToast({ title: '昵称至少 2 个字符', icon: 'none' })
    return false
  }
  if (cleanName.length > MAX_NICKNAME_LENGTH) {
    uni.showToast({ title: '昵称不能超过 20 个字符', icon: 'none' })
    return false
  }
  saving.value = true
  try {
    const heightCm = parseOptionalNumber(heightInput.value, 80, 250, '身高')
    await profileStore.saveProfile({
      nickname: cleanName,
      avatarUrl: avatarUrl.value.trim(),
      heightCm,
      trainingGoal: goal.value,
      experienceLevel: level.value
    })
    syncForm()
    uni.showToast({ title: '资料已保存', icon: 'none' })
    if (navigateAfterSave) {
      setTimeout(() => uni.navigateBack(), 350)
    }
    return true
  } catch (err) {
    uni.showToast({ title: err instanceof Error ? err.message : '保存失败，请重试', icon: 'none' })
    console.error('[profile-edit] save failed', err)
    return false
  } finally {
    saving.value = false
  }
}

async function chooseAvatar() {
  if (saving.value || avatarUploading.value) return
  try {
    const result = await new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject
      })
    })
    const filePath = result.tempFilePaths[0]
    if (!filePath) return
    avatarUploading.value = true
    const compressedFilePath = await prepareAvatarFile(filePath)
    avatarPreviewUrl.value = compressedFilePath
    avatarUrl.value = await uploadAvatar(compressedFilePath)
    await profileStore.refreshProfile()
    syncForm()
    uni.showToast({ title: '头像已更新', icon: 'none' })
  } catch (err) {
    uni.showToast({
      title: err instanceof Error ? err.message.slice(0, 30) : '头像上传失败，请重试',
      icon: 'none'
    })
    console.error('[profile-edit] avatar upload failed', err)
  } finally {
    avatarUploading.value = false
  }
}

async function prepareAvatarFile(filePath: string) {
  await assertSupportedImage(filePath)
  const compressedFilePath = await compressAvatar(filePath)
  await assertSupportedImage(compressedFilePath)
  const size = await getFileSize(compressedFilePath)
  if (size > MAX_AVATAR_SIZE) {
    throw new Error('头像图片不能超过 5MB')
  }
  return compressedFilePath
}

async function assertSupportedImage(filePath: string) {
  try {
    const info = await new Promise<UniApp.GetImageInfoSuccessData>((resolve, reject) => {
      uni.getImageInfo({
        src: filePath,
        success: resolve,
        fail: reject
      })
    })
    const type = String((info as UniApp.GetImageInfoSuccessData & { type?: string }).type || '')
      .toLowerCase()
      .replace('jpeg', 'jpg')
    const extension = fileExtension(filePath).replace('jpeg', 'jpg')
    const imageType = type || extension
    if (!['jpg', 'png', 'webp'].includes(imageType)) {
      throw new Error('头像仅支持 JPG、PNG、WEBP 图片')
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err
    }
    throw new Error('请选择 JPG、PNG、WEBP 图片')
  }
}

async function compressAvatar(filePath: string) {
  try {
    const result = await new Promise<{ tempFilePath?: string }>((resolve, reject) => {
      uni.compressImage({
        src: filePath,
        quality: 78,
        success: resolve,
        fail: reject
      })
    })
    return result.tempFilePath || filePath
  } catch (err) {
    console.error('[profile-edit] avatar compress failed', err)
    throw new Error('图片压缩失败，请重新选择')
  }
}

async function getFileSize(filePath: string) {
  const info = await new Promise<{ size: number }>((resolve, reject) => {
    uni.getFileInfo({
      filePath,
      success: resolve,
      fail: reject
    })
  })
  return info.size
}

function fileExtension(filePath: string) {
  const cleanPath = filePath.split('?')[0]
  const dotIndex = cleanPath.lastIndexOf('.')
  if (dotIndex < 0 || dotIndex === cleanPath.length - 1) {
    return ''
  }
  return cleanPath.slice(dotIndex + 1).toLowerCase()
}

function metricValue(metricType: string) {
  const metric = bodyMetrics.value.find((item) => item.metricType === metricType)
  if (!metric) return '--'
  const value = Number(metric.value)
  return Number.isFinite(value) ? `${value}${metric.unit}` : '--'
}

function openBodyMetrics() {
  if (navigating.value || saving.value) return
  if (!formDirty.value) {
    navigateToPage(routes.profileBodyMetrics)
    return
  }
  confirmUnsavedThenNavigate({
    title: '资料未保存',
    content: '是否先保存当前资料，再进入身体指标？',
    url: routes.profileBodyMetrics
  })
}

function openSettings() {
  if (navigating.value || saving.value) return
  if (!formDirty.value) {
    navigateToPage(routes.settings)
    return
  }
  confirmUnsavedThenNavigate({
    title: '资料未保存',
    content: '是否先保存当前资料，再进入训练偏好？',
    url: routes.settings
  })
}

function confirmUnsavedThenNavigate(options: { title: string; content: string; url: string }) {
  uni.hideKeyboard()
  setTimeout(() => {
    pendingNavigation.value = options
  }, 80)
}

function closeUnsavedPrompt() {
  pendingNavigation.value = null
}

function continueWithDraft() {
  const target = pendingNavigation.value
  if (!target || navigating.value) return
  pendingNavigation.value = null
  navigateToPage(target.url)
}

async function saveAndContinue() {
  const target = pendingNavigation.value
  if (!target || saving.value || navigating.value) return
  const saved = await save(false)
  if (!saved) return
  pendingNavigation.value = null
  navigateToPage(target.url)
}

function navigateToPage(url: string) {
  navigating.value = true
  uni.navigateTo({
    url,
    fail: (err) => {
      uni.showToast({ title: '页面打开失败，请重试', icon: 'none' })
      console.error('[profile-edit] navigate failed', { url, err })
    },
    complete: () => {
      navigating.value = false
    }
  })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell profile-edit safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="编辑资料" subtitle="完善个人信息与训练偏好" show-back @back="goBack" />

      <view class="profile-edit__hero">
        <view class="profile-edit__avatar-wrap btn-press" @tap="chooseAvatar">
          <image
            class="profile-edit__avatar"
            :src="avatarPreviewUrl || '/static/app-logo.png'"
            mode="aspectFill"
          />
          <view class="profile-edit__avatar-badge">
            {{ avatarUploading ? '...' : '◉' }}
          </view>
        </view>
        <view class="profile-edit__hero-body">
          <view class="profile-edit__hero-title">{{ nickname || '请输入昵称' }}</view>
          <view class="profile-edit__hero-sub">
            {{ displayWeight }} · {{ goal || '目标未设' }} · {{ level || '经验未设' }}
          </view>
          <view class="profile-edit__avatar-tip">点击头像更换照片</view>
        </view>
      </view>

      <view class="profile-edit__editor">
        <view class="profile-edit__group">
          <view class="profile-edit__group-title">基本资料</view>
          <view class="profile-edit__field">
            <view class="profile-edit__field-label">昵称</view>
            <input
              v-model="nickname"
              class="profile-edit__field-input"
              :maxlength="MAX_NICKNAME_LENGTH"
              placeholder="请输入昵称"
              placeholder-class="profile-edit__placeholder"
            />
            <view class="profile-edit__field-meta">{{ nickname.trim().length }}/20</view>
          </view>
          <view class="profile-edit__field">
            <view class="profile-edit__field-label">身高</view>
            <input
              v-model="heightInput"
              class="profile-edit__field-input"
              type="digit"
              placeholder="例如 178"
              placeholder-class="profile-edit__placeholder"
            />
            <view class="profile-edit__field-meta">cm</view>
          </view>
        </view>

        <view class="profile-edit__divider" />

        <view class="profile-edit__group">
          <view class="profile-edit__group-title">训练方向</view>
          <view class="profile-edit__choice-label">训练目标</view>
          <view class="profile-edit__chips profile-edit__chips--goals">
            <view
              v-for="item in goals"
              :key="item"
              class="profile-edit__chip btn-press"
              :class="{ 'profile-edit__chip--active': goal === item }"
              @tap="selectGoal(item)"
            >
              {{ item }}
            </view>
          </view>

          <view class="profile-edit__choice-label">训练经验</view>
          <view class="profile-edit__segments">
            <view
              v-for="item in levels"
              :key="item"
              class="profile-edit__segment btn-press"
              :class="{ 'profile-edit__segment--active': level === item }"
              @tap="selectLevel(item)"
            >
              {{ item }}
            </view>
          </view>
        </view>
      </view>

      <view class="profile-edit__links">
        <view class="profile-edit__link-row btn-press" @tap="openBodyMetrics">
          <view class="profile-edit__link-icon profile-edit__link-icon--body">◎</view>
          <view class="profile-edit__link-body">
            <view class="profile-edit__link-title">身体指标</view>
            <view class="profile-edit__link-sub">
              {{ metricValue('WEIGHT') }} · 体脂 {{ metricValue('BODY_FAT') }}
            </view>
          </view>
          <view class="profile-edit__link-arrow">›</view>
        </view>
        <view class="profile-edit__link-row btn-press" @tap="openSettings">
          <view class="profile-edit__link-icon profile-edit__link-icon--settings">⚙</view>
          <view class="profile-edit__link-body">
            <view class="profile-edit__link-title">训练偏好</view>
            <view class="profile-edit__link-sub">
              {{ profileStore.unit }} · 组间休息 {{ profileStore.restSeconds }}s
            </view>
          </view>
          <view class="profile-edit__link-arrow">›</view>
        </view>
      </view>

      <view class="profile-edit__save-bar">
        <PrimaryButton
          :disabled="saving || avatarUploading || !formDirty"
          :loading="saving"
          @tap="save()"
        >
          {{ saving ? '保存中...' : '保存资料' }}
        </PrimaryButton>
      </view>

      <view v-if="pendingNavigation" class="profile-edit__prompt">
        <view class="profile-edit__prompt-mask" @tap="closeUnsavedPrompt" />
        <view class="profile-edit__prompt-card">
          <view class="profile-edit__prompt-title">{{ pendingNavigation.title }}</view>
          <view class="profile-edit__prompt-desc">{{ pendingNavigation.content }}</view>
          <view class="profile-edit__prompt-note">稍后保存会保留当前页面草稿。</view>
          <view class="profile-edit__prompt-actions">
            <button class="profile-edit__prompt-secondary btn-press" @tap="continueWithDraft">
              稍后保存
            </button>
            <button
              class="profile-edit__prompt-primary gradient-fire btn-press"
              :disabled="saving"
              @tap="saveAndContinue"
            >
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.profile-edit {
  padding-bottom: 190rpx;

  &__hero {
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 10rpx 8rpx 28rpx;
  }

  &__avatar-wrap {
    position: relative;
    width: 112rpx;
    height: 112rpx;
    flex-shrink: 0;
  }

  &__avatar {
    width: 112rpx;
    height: 112rpx;
    border-radius: 32rpx;
    background: rgba(255, 80, 30, 0.12);
    border: 2rpx solid rgba(255, 118, 50, 0.42);
    box-shadow:
      0 12rpx 36rpx rgba(0, 0, 0, 0.34),
      0 0 28rpx rgba(255, 80, 30, 0.2);
  }

  &__avatar-badge {
    position: absolute;
    right: -8rpx;
    bottom: -6rpx;
    width: 42rpx;
    height: 42rpx;
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(135deg, #ff501e, #ff8c00);
    border: 4rpx solid #0b0b10;
    font-size: 17rpx;
    font-weight: 900;
    box-shadow: 0 6rpx 18rpx rgba(255, 80, 30, 0.36);
  }

  &__hero-body {
    min-width: 0;
    flex: 1;
  }

  &__hero-title {
    color: #f7f7fb;
    font-size: 36rpx;
    font-weight: 900;
    line-height: 1.2;
  }

  &__hero-sub {
    margin-top: 8rpx;
    color: #9d9daf;
    font-size: 23rpx;
  }

  &__avatar-tip {
    margin-top: 10rpx;
    color: #ff8d4e;
    font-size: 20rpx;
    font-weight: 800;
  }

  &__editor {
    padding: 30rpx 28rpx;
    border-radius: 28rpx;
    background:
      radial-gradient(circle at 100% 0%, rgba(255, 80, 30, 0.08), transparent 38%),
      rgba(255, 255, 255, 0.045);
    border: 1rpx solid rgba(255, 255, 255, 0.085);
    box-shadow: 0 20rpx 54rpx rgba(0, 0, 0, 0.22);
  }

  &__group-title {
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
  }

  &__field {
    position: relative;
    min-height: 112rpx;
    margin-top: 18rpx;
    padding: 18rpx 76rpx 12rpx 20rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.035);
    border: 1rpx solid rgba(255, 255, 255, 0.07);

    &:focus-within {
      border-color: rgba(255, 98, 38, 0.56);
      box-shadow: 0 0 22rpx rgba(255, 80, 30, 0.1);
    }
  }

  &__field-label,
  &__choice-label {
    color: #9d9daf;
    font-size: 21rpx;
    font-weight: 800;
  }

  &__field-input {
    width: 100%;
    height: 58rpx;
    color: #f7f7fb;
    font-size: 28rpx;
    font-weight: 800;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.12);
  }

  &__field-meta {
    position: absolute;
    right: 20rpx;
    bottom: 26rpx;
    color: #737386;
    font-size: 20rpx;
    font-weight: 700;
  }

  &__placeholder {
    color: #666679;
  }

  &__divider {
    height: 1rpx;
    margin: 30rpx 0;
    background: rgba(255, 255, 255, 0.08);
  }

  &__choice-label {
    margin-top: 24rpx;
  }

  &__chips {
    margin-top: 14rpx;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10rpx;
  }

  &__chip {
    min-width: 0;
    min-height: 64rpx;
    padding: 0 6rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c8c8d4;
    background: rgba(255, 255, 255, 0.045);
    border: 1rpx solid rgba(255, 255, 255, 0.08);
    font-size: 21rpx;
    font-weight: 800;

    &--active {
      color: #fff;
      background: linear-gradient(135deg, rgba(255, 80, 30, 0.85), rgba(255, 126, 40, 0.7));
      border-color: rgba(255, 132, 68, 0.75);
      box-shadow: 0 8rpx 20rpx rgba(255, 80, 30, 0.18);
    }
  }

  &__segments {
    margin-top: 14rpx;
    padding: 6rpx;
    border-radius: 20rpx;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6rpx;
    background: rgba(0, 0, 0, 0.22);
    border: 1rpx solid rgba(255, 255, 255, 0.07);
  }

  &__segment {
    min-height: 62rpx;
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9d9daf;
    font-size: 23rpx;
    font-weight: 900;

    &--active {
      color: #fff;
      background: rgba(255, 80, 30, 0.18);
      border: 1rpx solid rgba(255, 96, 35, 0.5);
      box-shadow: inset 0 0 18rpx rgba(255, 80, 30, 0.1);
    }
  }

  &__links {
    margin-top: 22rpx;
    overflow: hidden;
    border-radius: 26rpx;
    background: rgba(255, 255, 255, 0.04);
    border: 1rpx solid rgba(255, 255, 255, 0.08);
  }

  &__link-row {
    min-height: 116rpx;
    padding: 20rpx 24rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;

    & + & {
      border-top: 1rpx solid rgba(255, 255, 255, 0.07);
    }
  }

  &__link-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 28rpx;
    font-weight: 900;

    &--body {
      color: #ff9656;
      background: rgba(255, 80, 30, 0.13);
    }

    &--settings {
      color: #9adfff;
      background: rgba(53, 217, 255, 0.1);
    }
  }

  &__link-body {
    flex: 1;
    min-width: 0;
  }

  &__link-title {
    color: #f5f5fa;
    font-size: 27rpx;
    font-weight: 900;
  }

  &__link-sub {
    margin-top: 8rpx;
    color: #858598;
    font-size: 21rpx;
  }

  &__link-arrow {
    color: #ff7b3c;
    font-size: 38rpx;
    font-weight: 700;
  }

  &__save-bar {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(env(safe-area-inset-bottom) + 18rpx);
    z-index: 20;
    padding: 12rpx;
    border-radius: 32rpx;
    background: rgba(13, 13, 18, 0.88);
    border: 1rpx solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 -12rpx 40rpx rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(18rpx);
  }

  &__prompt {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40rpx;
  }

  &__prompt-mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4rpx);
  }

  &__prompt-card {
    position: relative;
    width: 88%;
    max-width: 620rpx;
    padding: 34rpx 30rpx 30rpx;
    border-radius: 28rpx;
    background: #211b1b;
    border: 1rpx solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 24rpx 70rpx rgba(0, 0, 0, 0.48);
  }

  &__prompt-title {
    color: #f7f7fb;
    font-size: 36rpx;
    font-weight: 900;
    line-height: 1.25;
    text-align: center;
  }

  &__prompt-desc {
    margin-top: 16rpx;
    color: #e6e2e8;
    font-size: 25rpx;
    line-height: 1.55;
    text-align: center;
  }

  &__prompt-note {
    margin-top: 10rpx;
    color: #9d9daf;
    font-size: 22rpx;
    line-height: 1.45;
    text-align: center;
  }

  &__prompt-actions {
    margin-top: 28rpx;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 16rpx;
  }

  &__prompt-secondary,
  &__prompt-primary {
    min-height: 88rpx;
    margin: 0;
    padding: 0 20rpx;
    border: 0;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 27rpx;
    font-weight: 900;
    line-height: 1.2;

    &::after {
      border: 0;
    }
  }

  &__prompt-secondary {
    color: #c8c8d4;
    background: rgba(255, 255, 255, 0.07);
    border: 1rpx solid rgba(255, 255, 255, 0.1);
  }

  &__prompt-primary {
    color: #fff;
    box-shadow: 0 12rpx 28rpx rgba(255, 80, 30, 0.3);
  }
}
</style>
