<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { uploadAvatar } from '@/api/user'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { cleanupAvatarTempFiles, isAvatarSelectionCancelled } from '@/utils/profile-avatar'
import type { ProfileEditableField } from '@/utils/profile-editing'

interface MiniProgramFileSystemManager {
  unlink(options: { filePath: string; success?: () => void; fail?: () => void }): void
}

interface UniWithFileSystemManager {
  getFileSystemManager?: () => MiniProgramFileSystemManager
}

const profileStore = useProfileStore()
const themeStore = useThemeStore()
const avatarUploading = ref(false)

const MAX_AVATAR_SIZE = 5 * 1024 * 1024

const heightLabel = computed(() =>
  profileStore.heightCm ? `${profileStore.heightCm} cm` : '未设置'
)

onShow(async () => {
  const ok = await ensureFeatureAuth('编辑资料')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await profileStore.refreshProfile()
})

function goBack() {
  uni.navigateBack()
}

function openFieldEditor(field: ProfileEditableField) {
  uni.navigateTo({ url: `${routes.profileEditField}?field=${field}` })
}

async function chooseAvatar() {
  if (avatarUploading.value) return
  const tempFiles: string[] = []
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
    tempFiles.push(filePath)
    avatarUploading.value = true
    const uploadFilePath = await prepareAvatarFile(filePath)
    tempFiles.push(uploadFilePath)
    await uploadAvatar(uploadFilePath)
    await profileStore.refreshProfile()
    uni.showToast({ title: '头像已更新', icon: 'none' })
  } catch (err) {
    if (isAvatarSelectionCancelled(err)) return
    uni.showToast({
      title: err instanceof Error ? err.message.slice(0, 30) : '头像上传失败，请重试',
      icon: 'none'
    })
    console.error('[profile-edit] avatar upload failed', err)
  } finally {
    avatarUploading.value = false
    await cleanupAvatarTempFiles(tempFiles, removeAvatarTempFile)
  }
}

async function prepareAvatarFile(filePath: string) {
  await assertSupportedImage(filePath)
  const compressedFilePath = await compressAvatar(filePath)
  await assertSupportedImage(compressedFilePath)
  const size = await getFileSize(compressedFilePath)
  if (size > MAX_AVATAR_SIZE) throw new Error('头像图片不能超过 5MB')
  return compressedFilePath
}

async function assertSupportedImage(filePath: string) {
  try {
    const info = await new Promise<UniApp.GetImageInfoSuccessData>((resolve, reject) => {
      uni.getImageInfo({ src: filePath, success: resolve, fail: reject })
    })
    const type = String((info as UniApp.GetImageInfoSuccessData & { type?: string }).type || '')
      .toLowerCase()
      .replace('jpeg', 'jpg')
    const imageType = type || fileExtension(filePath).replace('jpeg', 'jpg')
    if (!['jpg', 'png', 'webp'].includes(imageType)) {
      throw new Error('头像仅支持 JPG、PNG、WEBP 图片')
    }
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error('请选择 JPG、PNG、WEBP 图片')
  }
}

async function compressAvatar(filePath: string) {
  try {
    const result = await new Promise<{ tempFilePath?: string }>((resolve, reject) => {
      uni.compressImage({ src: filePath, quality: 78, success: resolve, fail: reject })
    })
    return result.tempFilePath || filePath
  } catch (err) {
    console.error('[profile-edit] avatar compress failed', err)
    throw new Error('图片压缩失败，请重新选择')
  }
}

async function getFileSize(filePath: string) {
  const info = await new Promise<{ size: number }>((resolve, reject) => {
    uni.getFileInfo({ filePath, success: resolve, fail: reject })
  })
  return info.size
}

function removeAvatarTempFile(filePath: string) {
  const manager = (uni as UniWithFileSystemManager).getFileSystemManager?.()
  if (!manager) return Promise.resolve()
  return new Promise<void>((resolve) => {
    manager.unlink({ filePath, success: resolve, fail: resolve })
  })
}

function fileExtension(filePath: string) {
  const cleanPath = filePath.split('?')[0]
  const dotIndex = cleanPath.lastIndexOf('.')
  return dotIndex < 0 || dotIndex === cleanPath.length - 1
    ? ''
    : cleanPath.slice(dotIndex + 1).toLowerCase()
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell profile-edit safe-bottom" :class="themeStore.themeClass">
      <view class="profile-edit__header">
        <view class="profile-edit__back btn-press" aria-label="返回" @tap="goBack">
          <image
            class="profile-edit__back-icon"
            src="/static/icons/chevron-down.svg"
            mode="aspectFit"
          />
        </view>
        <view class="profile-edit__title">个人资料</view>
        <view class="profile-edit__header-spacer" />
      </view>

      <view class="profile-edit__section-title">基础资料</view>
      <view class="profile-edit__card">
        <view class="profile-edit__row btn-press" @tap="chooseAvatar">
          <view class="profile-edit__label">头像</view>
          <view class="profile-edit__value-wrap">
            <image
              class="profile-edit__avatar"
              :src="profileStore.avatarDisplayUrl || '/static/app-logo.png'"
              mode="aspectFill"
            />
            <view v-if="avatarUploading" class="profile-edit__avatar-mask">上传中</view>
            <image
              class="profile-edit__chevron"
              src="/static/icons/chevron-down.svg"
              mode="aspectFit"
            />
          </view>
        </view>
        <view class="profile-edit__divider" />
        <view class="profile-edit__row btn-press" @tap="openFieldEditor('nickname')">
          <view class="profile-edit__label">昵称</view>
          <view class="profile-edit__value-wrap">
            <view class="profile-edit__value">{{ profileStore.nickname }}</view>
            <image
              class="profile-edit__chevron"
              src="/static/icons/chevron-down.svg"
              mode="aspectFit"
            />
          </view>
        </view>
        <view class="profile-edit__divider" />
        <view class="profile-edit__row btn-press" @tap="openFieldEditor('height')">
          <view class="profile-edit__label">身高</view>
          <view class="profile-edit__value-wrap">
            <view class="profile-edit__value">{{ heightLabel }}</view>
            <image
              class="profile-edit__chevron"
              src="/static/icons/chevron-down.svg"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.profile-edit {
  min-height: 100vh;
  padding-bottom: 80rpx;

  &__header {
    position: relative;
    min-height: 84rpx;
    margin-bottom: 34rpx;
    display: grid;
    grid-template-columns: 72rpx 1fr 72rpx;
    align-items: center;
  }

  &__back {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__back-icon {
    width: 34rpx;
    height: 34rpx;
    transform: rotate(90deg);
  }

  &__title {
    color: var(--app-text);
    font-size: 36rpx;
    font-weight: 900;
    text-align: center;
  }

  &__card {
    overflow: hidden;
    border: 1rpx solid var(--app-border);
    border-radius: 26rpx;
    background: var(--app-surface);
    box-shadow: var(--app-shadow-sm);
  }

  &__section-title {
    margin: 0 8rpx 14rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
    font-weight: 800;
  }

  &__row {
    min-height: 112rpx;
    padding: 0 28rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24rpx;
  }

  &__label {
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 800;
  }

  &__value-wrap {
    position: relative;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16rpx;
  }

  &__value {
    max-width: 360rpx;
    overflow: hidden;
    color: var(--app-text-muted);
    font-size: 26rpx;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__avatar {
    width: 78rpx;
    height: 78rpx;
    border-radius: 20rpx;
    background: var(--app-bg);
  }

  &__avatar-mask {
    position: absolute;
    right: 44rpx;
    width: 78rpx;
    height: 78rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: rgba(15, 23, 42, 0.58);
    font-size: 18rpx;
    font-weight: 800;
  }

  &__chevron {
    width: 28rpx;
    height: 28rpx;
    flex-shrink: 0;
    transform: rotate(-90deg);
    opacity: 0.72;
  }

  &__divider {
    height: 1rpx;
    margin-left: 28rpx;
    background: var(--app-border);
  }
}
</style>
