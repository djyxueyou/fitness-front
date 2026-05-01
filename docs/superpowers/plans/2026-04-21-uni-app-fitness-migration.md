# Uni-app Fitness Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 React 健身原型重构为支持微信小程序、iOS、Android 的 `uni-app + Vue 3 + TypeScript` 项目，并尽量保持现有 UI 与核心交互。

**Architecture:** 使用 uni-app CLI 的 Vue3/Vite/TypeScript 结构，将现有单路由原型改为真实页面路由，主导航使用 `tabBar`，二级页使用 `navigateTo`。共享状态使用 Pinia，页面和组件样式统一收敛到 `uni.scss` 和公共组件层，按主流程分批迁移页面并逐步做三端适配。

**Tech Stack:** uni-app CLI (Vue3 + Vite + TypeScript), Pinia, Sass/SCSS, uni-app pages.json/tabBar/navigation API, uni 兼容图表方案（推荐 `qiun-data-charts`）。

---

## Planned File Structure

### Keep For Reference

- Modify: `src/pages/**`
- Modify: `src/components/**`
- Modify: `src/index.css`
- Modify: `package.json`

现有 React 代码先保留一份只读参考副本，避免迁移中丢失 UI 细节。

### Create Uni-app App Shell

- Create: `src/App.vue`
- Create: `src/main.ts`
- Create: `src/pages.json`
- Create: `src/manifest.json`
- Create: `src/uni.scss`
- Create: `src/env.d.ts`

### Create Shared Runtime

- Create: `src/types/exercise.ts`
- Create: `src/types/template.ts`
- Create: `src/types/history.ts`
- Create: `src/mock/exercises.ts`
- Create: `src/mock/templates.ts`
- Create: `src/mock/history.ts`
- Create: `src/mock/profile.ts`
- Create: `src/utils/navigation.ts`
- Create: `src/utils/format.ts`

### Create Stores

- Create: `src/stores/workout.ts`
- Create: `src/stores/exercise.ts`
- Create: `src/stores/template.ts`
- Create: `src/stores/profile.ts`

### Create Shared Components

- Create: `src/components/app-header/index.vue`
- Create: `src/components/glass-card/index.vue`
- Create: `src/components/primary-button/index.vue`
- Create: `src/components/stat-card/index.vue`
- Create: `src/components/section-title/index.vue`
- Create: `src/components/tag-chip/index.vue`
- Create: `src/components/empty-state/index.vue`
- Create: `src/components/progress-bar/index.vue`
- Create: `src/components/toggle-switch/index.vue`
- Create: `src/components/exercise-item/index.vue`
- Create: `src/components/template-item/index.vue`

### Create Pages

- Create: `src/pages/home/index.vue`
- Create: `src/pages/home/select-template.vue`
- Create: `src/pages/home/workout-active.vue`
- Create: `src/pages/home/workout-calendar.vue`
- Create: `src/pages/home/volume-trend.vue`
- Create: `src/pages/home/history-detail.vue`
- Create: `src/pages/exercises/index.vue`
- Create: `src/pages/exercises/detail.vue`
- Create: `src/pages/profile/index.vue`
- Create: `src/pages/profile/history.vue`
- Create: `src/pages/profile/template-manager.vue`
- Create: `src/pages/profile/favorites.vue`
- Create: `src/pages/profile/settings.vue`
- Create: `src/pages/profile/about.vue`

### Verification / Docs

- Create: `docs/migration/uni-app-page-map.md`
- Modify: `README.md`

## Task 1: Scaffold The Uni-app Project Shell

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `src/App.vue`
- Create: `src/main.ts`
- Create: `src/pages.json`
- Create: `src/manifest.json`
- Create: `src/uni.scss`
- Create: `src/env.d.ts`

- [ ] **Step 1: Backup the current React app into a reference directory**

```powershell
New-Item -ItemType Directory -Force -Path src-react-reference | Out-Null
Copy-Item -Recurse -Force src\* src-react-reference\
```

Expected: `src-react-reference` contains the existing React implementation for visual reference during migration.

- [ ] **Step 2: Write a failing smoke checklist before touching the shell**

Create `docs/migration/uni-app-page-map.md` with the following initial checklist:

```md
# Uni-app Migration Smoke Checklist

- [ ] App starts with a uni-app entry
- [ ] pages.json registers all planned pages
- [ ] tabBar shows Home / Exercises / Profile
- [ ] App compiles for H5
- [ ] App compiles for mp-weixin
- [ ] App compiles for app-plus
```

- [ ] **Step 3: Replace the current web entry with a uni-app entry**

Write `src/main.ts`:

```ts
import App from './App.vue'
import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'

export function createApp() {
  const app = createSSRApp(App)
  app.use(Pinia.createPinia())

  return {
    app,
    Pinia,
  }
}
```

This follows the uni-app Pinia integration pattern documented by the official uni-app docs.

- [ ] **Step 4: Create the minimal app shell files**

Write `src/App.vue`:

```vue
<script setup lang="ts">
</script>

<style lang="scss">
@import './uni.scss';
</style>
```

Write `src/env.d.ts`:

```ts
/// <reference types="@dcloudio/types" />
```

- [ ] **Step 5: Register the real page routes and tabBar**

Write `src/pages.json` with the full page list and native tabBar:

```json
{
  "pages": [
    { "path": "pages/home/index", "style": { "navigationStyle": "custom" } },
    { "path": "pages/exercises/index", "style": { "navigationStyle": "custom" } },
    { "path": "pages/profile/index", "style": { "navigationStyle": "custom" } },
    { "path": "pages/home/select-template", "style": { "navigationStyle": "custom" } },
    { "path": "pages/home/workout-active", "style": { "navigationStyle": "custom" } },
    { "path": "pages/home/workout-calendar", "style": { "navigationStyle": "custom" } },
    { "path": "pages/home/volume-trend", "style": { "navigationStyle": "custom" } },
    { "path": "pages/home/history-detail", "style": { "navigationStyle": "custom" } },
    { "path": "pages/exercises/detail", "style": { "navigationStyle": "custom" } },
    { "path": "pages/profile/history", "style": { "navigationStyle": "custom" } },
    { "path": "pages/profile/template-manager", "style": { "navigationStyle": "custom" } },
    { "path": "pages/profile/favorites", "style": { "navigationStyle": "custom" } },
    { "path": "pages/profile/settings", "style": { "navigationStyle": "custom" } },
    { "path": "pages/profile/about", "style": { "navigationStyle": "custom" } }
  ],
  "globalStyle": {
    "navigationStyle": "custom",
    "backgroundColor": "#0A0A0E"
  },
  "tabBar": {
    "color": "#828296",
    "selectedColor": "#FF501E",
    "backgroundColor": "#0E0E14",
    "borderStyle": "black",
    "list": [
      { "pagePath": "pages/home/index", "text": "首页" },
      { "pagePath": "pages/exercises/index", "text": "动作库" },
      { "pagePath": "pages/profile/index", "text": "我的" }
    ]
  }
}
```

- [ ] **Step 6: Replace package scripts and dependencies with uni-app CLI dependencies**

Update `package.json` to the uni-app CLI model:

```json
{
  "scripts": {
    "dev:h5": "uni -p h5",
    "dev:mp-weixin": "uni -p mp-weixin",
    "build:h5": "uni build -p h5",
    "build:mp-weixin": "uni build -p mp-weixin",
    "build:app-plus": "uni build -p app-plus"
  }
}
```

Add the required uni-app dependencies and remove the current React runtime packages.

- [ ] **Step 7: Verify the shell compiles**

Run:

```powershell
npm install
npm run build:h5
npm run build:mp-weixin
npm run build:app-plus
```

Expected:
- H5 build succeeds
- mp-weixin build succeeds
- app-plus build succeeds

- [ ] **Step 8: Checkpoint**

If this workspace is under git in the actual execution environment:

```bash
git add package.json tsconfig.json src/App.vue src/main.ts src/pages.json src/manifest.json src/uni.scss src/env.d.ts docs/migration/uni-app-page-map.md src-react-reference
git commit -m "chore: scaffold uni-app application shell"
```

If git is unavailable, record a local milestone note in the implementation log instead of committing.

## Task 2: Establish Theme, Utilities, Types, Mock Data, And Navigation Helpers

**Files:**
- Create: `src/uni.scss`
- Create: `src/types/exercise.ts`
- Create: `src/types/template.ts`
- Create: `src/types/history.ts`
- Create: `src/mock/exercises.ts`
- Create: `src/mock/templates.ts`
- Create: `src/mock/history.ts`
- Create: `src/mock/profile.ts`
- Create: `src/utils/navigation.ts`
- Create: `src/utils/format.ts`

- [ ] **Step 1: Write the failing contract list for shared data**

Append to `docs/migration/uni-app-page-map.md`:

```md
- [ ] Shared exercise data can be imported by list/detail/favorites
- [ ] Shared template data can be imported by home and template manager
- [ ] Shared history data can be imported by calendar/history/detail
- [ ] Route helpers centralize navigateTo/switchTab path strings
```

- [ ] **Step 2: Create the core TypeScript types**

Write `src/types/exercise.ts`:

```ts
export interface Exercise {
  id: number
  name: string
  category: string
  muscle: string
  equipment: string
  level: '初级' | '中级' | '高级'
  favorited?: boolean
}
```

Write `src/types/template.ts`:

```ts
export interface Template {
  id: number
  name: string
  tag: string
  exercises: number
  duration: number
  level: '初级' | '中级' | '高级'
  muscles: string[]
}
```

Write `src/types/history.ts`:

```ts
export interface WorkoutHistoryRecord {
  date: string
  name: string
  duration: number
  type: 'push' | 'pull' | 'legs'
}
```

- [ ] **Step 3: Move page-local mock arrays into typed data modules**

Write `src/mock/exercises.ts`, `src/mock/templates.ts`, and `src/mock/history.ts` by extracting and fixing the current hardcoded data from the React pages, including the broken Chinese encoding.

Use this shape for `src/mock/exercises.ts`:

```ts
import type { Exercise } from '@/types/exercise'

export const exercises: Exercise[] = [
  {
    id: 1,
    name: '卧推',
    category: '胸',
    muscle: '胸大肌',
    equipment: '杠铃',
    level: '中级',
    favorited: false,
  },
]
```

- [ ] **Step 4: Add route helper utilities**

Write `src/utils/navigation.ts`:

```ts
export const routes = {
  home: '/pages/home/index',
  exercises: '/pages/exercises/index',
  profile: '/pages/profile/index',
  selectTemplate: '/pages/home/select-template',
  workoutActive: '/pages/home/workout-active',
  workoutCalendar: '/pages/home/workout-calendar',
  volumeTrend: '/pages/home/volume-trend',
  historyDetail: '/pages/home/history-detail',
  exerciseDetail: '/pages/exercises/detail',
  profileHistory: '/pages/profile/history',
  templateManager: '/pages/profile/template-manager',
  favorites: '/pages/profile/favorites',
  settings: '/pages/profile/settings',
  about: '/pages/profile/about',
} as const
```

- [ ] **Step 5: Add formatting helpers for repeated display logic**

Write `src/utils/format.ts`:

```ts
export function formatDuration(minutes: number) {
  return `${minutes} min`
}

export function formatWorkoutDate(value: string) {
  return value.replace(/-/g, '.')
}
```

- [ ] **Step 6: Build the global theme in `uni.scss`**

Write `src/uni.scss` with the design tokens derived from the current `src/index.css`:

```scss
$color-bg: #0a0a0e;
$color-card: #14141c;
$color-primary: #ff501e;
$color-primary-soft: #ffa03c;
$color-text: #f5f5fa;
$color-muted: #828296;
$color-border: rgba(255, 255, 255, 0.08);
$radius-lg: 24rpx;
$radius-xl: 32rpx;

page {
  background: $color-bg;
  color: $color-text;
  font-family: 'Poppins', sans-serif;
}
```

- [ ] **Step 7: Verify imports are type-safe**

Run:

```powershell
npm run build:h5
```

Expected: no missing alias/path/type errors from the new data and utility modules.

- [ ] **Step 8: Checkpoint**

```bash
git add src/uni.scss src/types src/mock src/utils docs/migration/uni-app-page-map.md
git commit -m "feat: add shared theme data and navigation helpers"
```

If git is unavailable, record the same milestone locally.

## Task 3: Add Shared UI Components

**Files:**
- Create: `src/components/app-header/index.vue`
- Create: `src/components/glass-card/index.vue`
- Create: `src/components/primary-button/index.vue`
- Create: `src/components/stat-card/index.vue`
- Create: `src/components/section-title/index.vue`
- Create: `src/components/tag-chip/index.vue`
- Create: `src/components/empty-state/index.vue`
- Create: `src/components/progress-bar/index.vue`
- Create: `src/components/toggle-switch/index.vue`
- Create: `src/components/exercise-item/index.vue`
- Create: `src/components/template-item/index.vue`

- [ ] **Step 1: Write the failing component checklist**

Append to `docs/migration/uni-app-page-map.md`:

```md
- [ ] Shared header renders back button and right slot
- [ ] Glass card style is reused across all pages
- [ ] Primary CTA matches current orange gradient look
- [ ] Exercise and template list items render from typed props
```

- [ ] **Step 2: Implement the shared page header**

Write `src/components/app-header/index.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle?: string
  showBack?: boolean
}>()

const emit = defineEmits<{
  back: []
}>()
</script>

<template>
  <view class="app-header">
    <view class="app-header__left">
      <view v-if="props.showBack" class="app-header__back" @tap="emit('back')">‹</view>
      <view>
        <view class="app-header__title">{{ props.title }}</view>
        <view v-if="props.subtitle" class="app-header__subtitle">{{ props.subtitle }}</view>
      </view>
    </view>
    <slot name="right" />
  </view>
</template>
```

- [ ] **Step 3: Implement the base card and primary button**

Write `src/components/glass-card/index.vue`:

```vue
<template>
  <view class="glass-card">
    <slot />
  </view>
</template>
```

Write `src/components/primary-button/index.vue`:

```vue
<script setup lang="ts">
defineProps<{ text?: string; block?: boolean }>()
</script>

<template>
  <view class="primary-button">
    <slot>{{ text }}</slot>
  </view>
</template>
```

- [ ] **Step 4: Implement data-display helpers**

Write `src/components/stat-card/index.vue`, `src/components/tag-chip/index.vue`, and `src/components/progress-bar/index.vue` as thin display components with typed props.

For `stat-card` use:

```ts
defineProps<{
  label: string
  value: string
  sub?: string
}>()
```

- [ ] **Step 5: Implement state and list item components**

Write `src/components/toggle-switch/index.vue`, `src/components/empty-state/index.vue`, `src/components/exercise-item/index.vue`, and `src/components/template-item/index.vue` using `@tap` events and typed props instead of React-style callbacks.

- [ ] **Step 6: Verify the components compile cleanly**

Create a temporary preview use in one page shell if needed, then run:

```powershell
npm run build:h5
```

Expected: all shared components compile and no SFC syntax errors remain.

- [ ] **Step 7: Checkpoint**

```bash
git add src/components docs/migration/uni-app-page-map.md
git commit -m "feat: add shared uni-app UI components"
```

If git is unavailable, record the same milestone locally.

## Task 4: Create Pinia Stores For Shared App State

**Files:**
- Create: `src/stores/workout.ts`
- Create: `src/stores/exercise.ts`
- Create: `src/stores/template.ts`
- Create: `src/stores/profile.ts`

- [ ] **Step 1: Write the failing state checklist**

Append to `docs/migration/uni-app-page-map.md`:

```md
- [ ] Favorites update detail/list/profile pages consistently
- [ ] Active workout survives navigation between workout-related pages
- [ ] Template edits are visible in selection and manager pages
- [ ] Settings persist within the running app session
```

- [ ] **Step 2: Add the exercise store**

Write `src/stores/exercise.ts`:

```ts
import { defineStore } from 'pinia'
import { exercises as seedExercises } from '@/mock/exercises'

export const useExerciseStore = defineStore('exercise', {
  state: () => ({
    items: seedExercises,
  }),
  getters: {
    favorites: (state) => state.items.filter((item) => item.favorited),
  },
  actions: {
    toggleFavorite(id: number) {
      this.items = this.items.map((item) =>
        item.id === id ? { ...item, favorited: !item.favorited } : item,
      )
    },
  },
})
```

- [ ] **Step 3: Add the workout and template stores**

Write `src/stores/workout.ts` with:

```ts
export const useWorkoutStore = defineStore('workout', {
  state: () => ({
    activeTemplateId: null as number | null,
    elapsedSeconds: 0,
    activeExercises: [] as Array<{
      id: number
      name: string
      muscle: string
      sets: Array<{ reps: number; weight: number; done: boolean }>
    }>,
  }),
  actions: {
    startWorkout(templateId: number | null) {
      this.activeTemplateId = templateId
      this.elapsedSeconds = 0
    },
  },
})
```

Write `src/stores/template.ts` with CRUD actions against the mock templates.

- [ ] **Step 4: Add the profile/settings store**

Write `src/stores/profile.ts`:

```ts
export const useProfileStore = defineStore('profile', {
  state: () => ({
    notifications: true,
    darkMode: true,
    unit: 'kg' as 'kg' | 'lb',
  }),
})
```

- [ ] **Step 5: Verify store wiring against the official uni-app Pinia shape**

Ensure `src/main.ts` returns both `app` and `Pinia`, as required by the uni-app docs for Pinia integration.

- [ ] **Step 6: Run a compile verification**

```powershell
npm run build:h5
```

Expected: store imports resolve, and there are no `defineStore` / `Pinia` integration errors.

- [ ] **Step 7: Checkpoint**

```bash
git add src/stores docs/migration/uni-app-page-map.md
git commit -m "feat: add shared app state stores"
```

If git is unavailable, record the same milestone locally.

## Task 5: Migrate The Home Flow

**Files:**
- Create: `src/pages/home/index.vue`
- Create: `src/pages/home/select-template.vue`
- Create: `src/pages/home/workout-active.vue`
- Create: `src/pages/home/workout-calendar.vue`
- Create: `src/pages/home/volume-trend.vue`
- Create: `src/pages/home/history-detail.vue`

- [ ] **Step 1: Write the failing home-flow checklist**

Append to `docs/migration/uni-app-page-map.md`:

```md
- [ ] Home tab opens select-template page
- [ ] Select-template opens workout-active with chosen template
- [ ] Workout finish returns safely
- [ ] Calendar opens detail and trend pages
```

- [ ] **Step 2: Implement the home tab page**

Port the current React `HomePage` into `src/pages/home/index.vue` using:

```vue
<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-home">
      <view class="page-home__hero">...</view>
      <view class="page-home__stats">...</view>
      <primary-button @tap="goSelectTemplate">开始训练</primary-button>
    </view>
  </scroll-view>
</template>
```

Navigation handler:

```ts
function goSelectTemplate() {
  uni.navigateTo({ url: routes.selectTemplate })
}
```

- [ ] **Step 3: Implement the select-template page**

Port the template cards, free workout CTA, and manage button from the React source. Use `useTemplateStore()` and `useWorkoutStore()` instead of in-page `useState`.

Use this navigation handler:

```ts
function startWorkout(templateId: number | null) {
  workoutStore.startWorkout(templateId)
  uni.navigateTo({ url: routes.workoutActive })
}
```

- [ ] **Step 4: Implement the active workout page**

Port the timer, progress bar, quick stats, set-completion UI, and finish modal. Use `onUnload` to stop any interval/timer resources.

Use a timer lifecycle like:

```ts
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => workoutStore.elapsedSeconds++, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
```

- [ ] **Step 5: Implement calendar, trend, and history-detail**

Port the month grid, recent history list, trend visualization shell, and history detail stats. Replace the current `recharts` dependency with a uni-compatible chart component only on the trend page.

- [ ] **Step 6: Verify the entire home flow**

Run:

```powershell
npm run build:h5
npm run build:mp-weixin
```

Then manually verify:
- Home tab loads
- Start workout enters select-template
- Free workout and template workout both open workout-active
- Calendar opens and detail pages navigate correctly

- [ ] **Step 7: Checkpoint**

```bash
git add src/pages/home docs/migration/uni-app-page-map.md
git commit -m "feat: migrate home workout flow to uni-app"
```

If git is unavailable, record the same milestone locally.

## Task 6: Migrate The Exercises Flow

**Files:**
- Create: `src/pages/exercises/index.vue`
- Create: `src/pages/exercises/detail.vue`

- [ ] **Step 1: Write the failing exercise-flow checklist**

Append to `docs/migration/uni-app-page-map.md`:

```md
- [ ] Search filters by name and muscle
- [ ] Category chips filter the list
- [ ] Favorite toggle updates list and detail
- [ ] Detail page can add the exercise into the workout store
```

- [ ] **Step 2: Implement the exercise list page**

Port the current `ExercisesPage` into `src/pages/exercises/index.vue` using store-backed filtering:

```ts
const searchText = ref('')
const activeCategory = ref('全部')

const filteredExercises = computed(() =>
  exerciseStore.items.filter((item) => {
    const catMatch = activeCategory.value === '全部' || item.category === activeCategory.value
    const text = searchText.value.trim()
    const searchMatch = !text || item.name.includes(text) || item.muscle.includes(text)
    return catMatch && searchMatch
  }),
)
```

- [ ] **Step 3: Implement the exercise detail page**

Read the route param in `onLoad`, look up the exercise from the store, and render:
- header
- pseudo GIF/demo block
- info chips
- tips
- best records
- add-to-workout CTA

- [ ] **Step 4: Connect “add to workout” to the workout store**

Add a store action in `src/stores/workout.ts`:

```ts
addExercise(name: string, muscle: string) {
  this.activeExercises.push({
    id: Date.now(),
    name,
    muscle,
    sets: [
      { reps: 12, weight: 20, done: false },
    ],
  })
}
```

Call it from the detail page instead of using a no-op callback.

- [ ] **Step 5: Verify the exercises flow**

Run:

```powershell
npm run build:h5
```

Then manually verify:
- category filtering
- search input
- favorite toggle in list and detail
- detail page route
- add-to-workout state update

- [ ] **Step 6: Checkpoint**

```bash
git add src/pages/exercises src/stores/workout.ts docs/migration/uni-app-page-map.md
git commit -m "feat: migrate exercises flow to uni-app"
```

If git is unavailable, record the same milestone locally.

## Task 7: Migrate The Profile Flow

**Files:**
- Create: `src/pages/profile/index.vue`
- Create: `src/pages/profile/history.vue`
- Create: `src/pages/profile/template-manager.vue`
- Create: `src/pages/profile/favorites.vue`
- Create: `src/pages/profile/settings.vue`
- Create: `src/pages/profile/about.vue`

- [ ] **Step 1: Write the failing profile-flow checklist**

Append to `docs/migration/uni-app-page-map.md`:

```md
- [ ] Profile menu opens all secondary pages
- [ ] History list opens detail page by date
- [ ] Favorites page reflects exercise store favorites
- [ ] Settings toggles mutate profile store state
- [ ] Template manager edits persist through the template store
```

- [ ] **Step 2: Implement the main profile tab page**

Port the hero block, achievement stats, feature menu, and “other” section. Each menu item should use real route navigation rather than local `view` state.

- [ ] **Step 3: Implement history and favorites pages**

Create `src/pages/profile/history.vue` using shared history mock data and route into `/pages/home/history-detail?date=...`.

Create `src/pages/profile/favorites.vue` using:

```ts
const exerciseStore = useExerciseStore()
const favorites = computed(() => exerciseStore.favorites)
```

- [ ] **Step 4: Implement template manager backed by the template store**

Port rename/delete/copy actions and move them into `useTemplateStore()` actions so the same data is visible on the select-template page.

- [ ] **Step 5: Implement settings and about**

Settings should bind directly to `useProfileStore()`. About should port the current feature list and external-link rows, but avoid unsupported browser-only behavior.

- [ ] **Step 6: Verify the profile flow**

Run:

```powershell
npm run build:h5
npm run build:mp-weixin
```

Then manually verify:
- profile routes
- history/detail linkage
- template CRUD
- favorites sync
- settings toggles

- [ ] **Step 7: Checkpoint**

```bash
git add src/pages/profile src/stores/template.ts src/stores/profile.ts docs/migration/uni-app-page-map.md
git commit -m "feat: migrate profile flow to uni-app"
```

If git is unavailable, record the same milestone locally.

## Task 8: Cross-platform Polish, Encoding Cleanup, And Final Verification

**Files:**
- Modify: `src/mock/**`
- Modify: `src/pages/**`
- Modify: `src/components/**`
- Modify: `README.md`

- [ ] **Step 1: Write the failing final verification checklist**

Append to `docs/migration/uni-app-page-map.md`:

```md
- [ ] No mojibake / garbled Chinese remains
- [ ] Safe-area spacing is correct on top and bottom
- [ ] H5 / mp-weixin / app-plus builds all succeed
- [ ] Core flows were manually spot-checked after the final build
```

- [ ] **Step 2: Fix all remaining encoding issues**

Search the migrated codebase for garbled Chinese copied from the React source and replace it with proper Simplified Chinese strings.

Run:

```powershell
Get-ChildItem -Recurse -File src | Select-String -Pattern "�|鍏|鏃|鎴|璁" 
```

Expected: either no obvious mojibake remains, or the remaining matches are manually reviewed and corrected.

- [ ] **Step 3: Add safe-area and platform polish**

Ensure page containers include top/bottom padding helpers and use conditional styling where needed for App and mini-program differences.

Use a page shell pattern like:

```scss
.page-shell {
  min-height: 100vh;
  padding: calc(var(--status-bar-height, 0px) + 24rpx) 32rpx calc(env(safe-area-inset-bottom) + 32rpx);
  box-sizing: border-box;
}
```

- [ ] **Step 4: Update the README**

Add:
- supported platforms
- required commands
- build commands for H5, mp-weixin, app-plus
- current chart/icon compatibility notes

- [ ] **Step 5: Run final verification**

Run:

```powershell
npm run build:h5
npm run build:mp-weixin
npm run build:app-plus
```

Expected: all three builds pass with no blocking compile errors.

- [ ] **Step 6: Perform manual QA against the smoke checklist**

Manually test:
- Home workout flow
- Exercise search/detail/favorite flow
- Profile/history/template/settings flow
- Back navigation on secondary pages
- Bottom tab behavior

- [ ] **Step 7: Final checkpoint**

```bash
git add README.md src docs/migration/uni-app-page-map.md
git commit -m "feat: complete uni-app multi-platform migration"
```

If git is unavailable, record the same milestone locally and capture the final verification commands/results in the task log.

## Self-review

### Spec coverage

- 页面路由重构：Task 1, 5, 6, 7
- 组件拆分与复用：Task 3
- 状态与 mock 数据收敛：Task 2, 4
- 三端兼容：Task 1, 5, 7, 8
- UI 还原：Task 2, 3, 5, 6, 7
- 中文乱码修复：Task 2, 8

### Placeholder scan

本计划未使用 `TODO`、`TBD`、`later` 等占位项。所有任务都明确了文件、动作、命令或最小代码形态。

### Type consistency

- 页面路径统一以 `routes` 常量为准
- 数据类型统一从 `src/types` 输出
- Store 名称与页面消费名称一致：`workout`, `exercise`, `template`, `profile`

## Notes

- 官方 uni-app CLI 文档显示 Vue3/Vite TypeScript 项目可通过 `npx degit dcloudio/uni-preset-vue#vite-ts` 创建，且通过 `npm run dev:%PLATFORM%` / `npm run build:%PLATFORM%` 进行多端运行与构建。
- 官方 Pinia 文档要求在 `main.ts` 中 `app.use(Pinia.createPinia())`，并在 `createApp` 返回值中包含 `Pinia`。
- 当前工作区不是 git 仓库，因此实际执行时如仍无 git，需要把“commit”步骤降级为本地 checkpoint 记录；如果后续在真实仓库中执行，则按原命令提交。
