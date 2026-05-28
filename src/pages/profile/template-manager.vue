<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppActionSheet from '@/components/app-action-sheet/index.vue'
import AppHeader from '@/components/app-header/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { useTemplateStore } from '@/stores/template'
import type { Template } from '@/types/template'

interface ActionSheetItem {
  key: string
  label: string
  description?: string
  danger?: boolean
  primary?: boolean
}

const templateStore = useTemplateStore()
const editingId = ref<number | null>(null)
const editName = ref('')
const saving = ref(false)
const actionSheetVisible = ref(false)
const actionSheetTitle = ref('')
const actionSheetSubtitle = ref('')
const actionSheetItems = ref<ActionSheetItem[]>([])
const actionTarget = ref<Template | null>(null)

onShow(async () => {
  const ok = await ensureFeatureAuth('模板管理')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  templateStore.fetchTemplates({ includeDetails: false })
})

function goBack() {
  uni.navigateBack()
}

async function createTemplate() {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  uni.navigateTo({ url: routes.templateEdit })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `${routes.templateDetail}?id=${id}` })
}

async function editTemplate(item: Template) {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (item.templateType === 'SYSTEM') return
  uni.navigateTo({ url: `${routes.templateEdit}?id=${item.id}` })
}

async function startRename(item: Template) {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (item.templateType === 'SYSTEM') return
  editingId.value = item.id
  editName.value = item.name
}

function cancelRename() {
  editingId.value = null
  editName.value = ''
}

async function saveRename() {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (editingId.value === null || !editName.value.trim() || saving.value) return
  saving.value = true
  try {
    await templateStore.rename(editingId.value, editName.value.trim())
    cancelRename()
    uni.showToast({ title: '已重命名', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '重命名失败', icon: 'none' })
    console.error('[template] rename failed', err)
  } finally {
    saving.value = false
  }
}

async function duplicateTemplate(id: number) {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (saving.value) return
  saving.value = true
  try {
    await templateStore.duplicate(id)
    uni.showToast({ title: '已复制到我的模板', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '复制失败', icon: 'none' })
    console.error('[template] duplicate failed', err)
  } finally {
    saving.value = false
  }
}

async function removeTemplate(id: number) {
  if (!(await ensureFeatureAuth('模板管理'))) return
  if (saving.value) return
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '删除模板',
      content: '删除后不可恢复，确认删除这个自定义模板吗？',
      confirmText: '删除',
      confirmColor: '#ff501e',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return

  saving.value = true
  try {
    await templateStore.remove(id)
    uni.showToast({ title: '已删除', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' })
    console.error('[template] remove failed', err)
  } finally {
    saving.value = false
  }
}

function openUserTemplateActions(item: Template) {
  actionTarget.value = item
  actionSheetTitle.value = '管理我的模板'
  actionSheetSubtitle.value = item.name
  actionSheetItems.value = [
    { key: 'detail', label: '查看详情', description: '查看动作安排和目标组数' },
    { key: 'edit', label: '编辑内容', description: '调整动作、顺序和组数', primary: true },
    { key: 'rename', label: '重命名', description: '修改模板名称' },
    { key: 'duplicate', label: '复制副本', description: '复制一份新的自定义模板' },
    { key: 'delete', label: '删除模板', description: '删除后不可恢复', danger: true }
  ]
  actionSheetVisible.value = true
}

function openSystemTemplateActions(item: Template) {
  actionTarget.value = item
  actionSheetTitle.value = '系统模板'
  actionSheetSubtitle.value = item.name
  actionSheetItems.value = [
    { key: 'detail', label: '查看详情', description: '查看系统模板动作安排' },
    { key: 'duplicate', label: '复制到我的模板', description: '复制后可自由编辑', primary: true }
  ]
  actionSheetVisible.value = true
}

function closeActionSheet() {
  actionSheetVisible.value = false
}

function handleTemplateAction(action: ActionSheetItem) {
  const item = actionTarget.value
  closeActionSheet()
  if (!item) return
  if (action.key === 'detail') goDetail(item.id)
  if (action.key === 'edit') editTemplate(item)
  if (action.key === 'rename') startRename(item)
  if (action.key === 'duplicate') duplicateTemplate(item.id)
  if (action.key === 'delete') removeTemplate(item.id)
}
</script>

<template>
  <view class="template-manager-page">
    <scroll-view scroll-y class="page-scroll">
      <view class="page-shell template-manager safe-bottom">
        <AppHeader title="模板管理" subtitle="系统模板可查看和复制，自定义模板可编辑" show-back @back="goBack" />

        <view class="template-manager__summary glass-card">
          <view class="template-manager__summary-item">
            <view class="template-manager__summary-value">{{ templateStore.userItems.length }}</view>
            <view class="template-manager__summary-label">我的模板</view>
          </view>
          <view class="template-manager__summary-item">
            <view class="template-manager__summary-value">{{ templateStore.systemItems.length }}</view>
            <view class="template-manager__summary-label">系统模板</view>
          </view>
          <view class="template-manager__create btn-press" @tap="createTemplate">新建模板</view>
        </view>

        <view class="template-manager__section-title">我的模板</view>
        <view class="template-manager__list">
          <view v-if="!templateStore.userItems.length" class="glass-card template-manager__empty">
            还没有自定义模板。可以从系统模板复制，或点击“新建模板”创建。
          </view>

          <view
            v-for="item in templateStore.userItems"
            :key="item.id"
            class="glass-card template-manager__item"
          >
            <template v-if="editingId === item.id">
              <input v-model="editName" class="template-manager__input" focus />
              <view class="template-manager__rename-actions">
                <view class="template-manager__small-btn template-manager__small-btn--primary" @tap="saveRename">
                  保存
                </view>
                <view class="template-manager__small-btn" @tap="cancelRename">取消</view>
              </view>
            </template>

            <template v-else>
              <view class="template-manager__row">
                <view class="template-manager__main" @tap="goDetail(item.id)">
                  <view
                    class="template-manager__icon"
                    :style="{ background: item.color, color: item.accent }"
                  >
                    {{ item.tag }}
                  </view>
                  <view class="template-manager__body">
                    <view class="template-manager__name">{{ item.name }}</view>
                    <view class="template-manager__meta">
                      {{ item.exercises }} 个动作 · {{ item.duration }} min
                    </view>
                    <view v-if="item.description" class="template-manager__desc">
                      {{ item.description }}
                    </view>
                  </view>
                </view>

                <view class="template-manager__menu btn-press" @tap.stop="openUserTemplateActions(item)">
                  管理
                </view>
              </view>
            </template>
          </view>
        </view>

        <view class="template-manager__section-title">系统模板</view>
        <view class="template-manager__list">
          <view
            v-for="item in templateStore.systemItems"
            :key="item.id"
            class="glass-card template-manager__item template-manager__item--system"
          >
            <view class="template-manager__row">
              <view class="template-manager__main" @tap="goDetail(item.id)">
                <view
                  class="template-manager__icon"
                  :style="{ background: item.color, color: item.accent }"
                >
                  SYS
                </view>
                <view class="template-manager__body">
                  <view class="template-manager__name">{{ item.name }}</view>
                  <view class="template-manager__meta">
                    {{ item.exercises }} 个动作 · 只读，可复制到我的模板
                  </view>
                  <view v-if="item.description" class="template-manager__desc">
                    {{ item.description }}
                  </view>
                </view>
              </view>

              <view class="template-manager__menu template-manager__menu--primary btn-press" @tap.stop="openSystemTemplateActions(item)">
                复制
              </view>
            </view>
          </view>
        </view>
      </view>

    </scroll-view>

    <AppActionSheet
      :visible="actionSheetVisible"
      :title="actionSheetTitle"
      :subtitle="actionSheetSubtitle"
      :items="actionSheetItems"
      @close="closeActionSheet"
      @select="handleTemplateAction"
    />
  </view>
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.template-manager {
  &__summary {
    padding: 24rpx;
    display: grid;
    grid-template-columns: 1fr 1fr 180rpx;
    align-items: center;
    gap: 18rpx;
    margin-bottom: 30rpx;
  }

  &__summary-item {
    min-width: 0;
  }

  &__summary-value {
    color: #f5f5fa;
    font-size: 42rpx;
    font-weight: 900;
  }

  &__summary-label {
    margin-top: 4rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__create {
    height: 72rpx;
    border-radius: 24rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 900;
  }

  &__section-title {
    margin: 28rpx 0 16rpx;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 18rpx;
  }

  &__item {
    padding: 24rpx;
    border-color: rgba(255, 255, 255, 0.08);

    &--system {
      background: rgba(255, 255, 255, 0.035);
    }
  }

  &__row,
  &__main {
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__row {
    justify-content: space-between;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta,
  &__desc {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
    line-height: 1.45;
  }

  &__desc {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__menu,
  &__small-btn {
    min-width: 92rpx;
    min-height: 56rpx;
    padding: 0 18rpx;
    border-radius: 18rpx;
    background: rgba(255, 255, 255, 0.07);
    color: #f5f5fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 900;
    flex-shrink: 0;

    &--primary {
      background: rgba(255, 80, 30, 0.14);
      color: #ff7a32;
      border: 1px solid rgba(255, 80, 30, 0.2);
    }
  }

  &__rename-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 22rpx;
  }

  &__small-btn--primary {
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
  }

  &__input {
    min-height: 78rpx;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 800;
    border-bottom: 1px solid rgba(255, 80, 30, 0.6);
  }

  &__empty {
    padding: 28rpx;
    color: #828296;
    font-size: 24rpx;
    line-height: 1.6;
  }
}
</style>
