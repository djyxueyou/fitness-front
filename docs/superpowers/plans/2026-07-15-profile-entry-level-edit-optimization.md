# Profile Entry, Level Detail, and Edit Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make profile editing and level details independently discoverable, render truthful level-route ranges, and remove duplicate links from profile editing.

**Architecture:** Keep the existing Vue pages and API contracts. Move display-only mappings into focused TypeScript utilities so level ranges and profile labels can be tested without mounting uni-app pages, then update the existing components and page templates to consume those mappings.

**Tech Stack:** Vue 3, TypeScript, uni-app, SCSS, Vitest

## Global Constraints

- Only modify `fitness-front/`; do not change backend APIs or database structures.
- Preserve H5 and WeChat Mini Program compatibility.
- Preserve light and dark theme support through existing theme variables and overrides.
- The shared worktree already contains unrelated user changes; do not stage, revert, or commit those files.
- Keep the menu label “设置”; its subtitle is “训练、单位与应用偏好”.

---

### Task 1: Presentation mappings and regression tests

**Files:**
- Create: `src/utils/training-level-presentation.ts`
- Create: `src/utils/profile-presentation.ts`
- Create: `src/utils/__tests__/training-level-presentation.test.ts`
- Create: `src/utils/__tests__/profile-presentation.test.ts`
- Create: `src/utils/__tests__/profile-pages-layout.test.ts`

**Interfaces:**
- Produces: `TRAINING_BADGE_PREVIEWS`, `PROFILE_GOAL_OPTIONS`, `PROFILE_EXPERIENCE_OPTIONS`, `profileGoalLabel()`, `profileExperienceLabel()`, `normalizeProfileGoal()`, and `normalizeProfileExperience()`.
- Consumes: No production modules; utilities are pure TypeScript.

- [ ] **Step 1: Write failing mapping tests**

```ts
expect(TRAINING_BADGE_PREVIEWS.map((item) => item.range)).toEqual([
  'Lv.1–5',
  'Lv.6–10',
  'Lv.11–20',
  'Lv.21–35',
  'Lv.36–55',
  'Lv.56–80',
  'Lv.81+'
])
expect(profileGoalLabel('FAT_LOSS')).toBe('减脂')
expect(profileExperienceLabel('BEGINNER')).toBe('新手')
expect(normalizeProfileGoal('减脂')).toBe('FAT_LOSS')
```

- [ ] **Step 2: Write failing page-source regression tests**

```ts
expect(profileSource).toContain('class="profile__level-entry btn-press"')
expect(profileSource).not.toContain(':level="index + 1"')
expect(editSource).not.toContain('profile-edit__links')
expect(editSource).not.toContain('fetchLatestBodyMetrics')
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `npm run test:run -- src/utils/__tests__/training-level-presentation.test.ts src/utils/__tests__/profile-presentation.test.ts src/utils/__tests__/profile-pages-layout.test.ts`

Expected: FAIL because the presentation utilities and new page structure do not exist yet.

- [ ] **Step 4: Add the pure presentation utilities**

```ts
export const TRAINING_BADGE_PREVIEWS = [
  { badgeCode: 'BRONZE', badgeName: '青铜', range: 'Lv.1–5', accentColor: '#cd7f32' },
  { badgeCode: 'SILVER', badgeName: '白银', range: 'Lv.6–10', accentColor: '#b8c0cc' },
  { badgeCode: 'GOLD', badgeName: '黄金', range: 'Lv.11–20', accentColor: '#d6a63a' },
  { badgeCode: 'PLATINUM', badgeName: '铂金', range: 'Lv.21–35', accentColor: '#94a3b8' },
  { badgeCode: 'DIAMOND', badgeName: '钻石', range: 'Lv.36–55', accentColor: '#60a5fa' },
  { badgeCode: 'STELLAR', badgeName: '星耀', range: 'Lv.56–80', accentColor: '#8b5cf6' },
  { badgeCode: 'GLORY', badgeName: '荣耀', range: 'Lv.81+', accentColor: '#f59e0b' }
] as const
```

Profile utilities expose code/label option arrays and accept both code values and legacy Chinese labels when normalizing.

- [ ] **Step 5: Run utility tests**

Run: `npm run test:run -- src/utils/__tests__/training-level-presentation.test.ts src/utils/__tests__/profile-presentation.test.ts`

Expected: PASS.

### Task 2: Split profile actions and correct the level sheet

**Files:**
- Modify: `src/pages/profile/index.vue`
- Modify: `src/components/training-level-badge/index.vue`
- Test: `src/utils/__tests__/profile-pages-layout.test.ts`

**Interfaces:**
- Consumes: `TRAINING_BADGE_PREVIEWS` from Task 1.
- Produces: Separate identity and level tap targets plus a badge `showLevel` prop used by the route preview.

- [ ] **Step 1: Add `showLevel?: boolean` to the badge component**

The default is `true`; the route preview passes `false`, while the current-level card keeps the default.

- [ ] **Step 2: Split the top card into two sibling tap targets**

```vue
<view class="profile__identity btn-press" @tap="openPage(routes.profileEdit)">...</view>
<view class="profile__level-entry btn-press" @tap="openLevelDetail">...</view>
<view class="profile__stats">...</view>
```

The identity row shows “编辑资料”; the level row shows `levelTitle`, remaining XP, a progress bar, and “等级详情”.

- [ ] **Step 3: Update the level-route cards**

Use `TRAINING_BADGE_PREVIEWS`, pass `:show-level="false"`, add “当前” or “未解锁” text, and remove `:level="index + 1"`.

- [ ] **Step 4: Improve the sheet shell and actions**

Raise the sheet height, keep header/footer fixed, add horizontal-scroll guidance, and change the primary CTA to “去完成有效训练”.

- [ ] **Step 5: Run the page regression test**

Run: `npm run test:run -- src/utils/__tests__/profile-pages-layout.test.ts`

Expected: profile-page assertions PASS; edit-page assertions remain failing until Task 3.

### Task 3: Simplify and localize profile editing

**Files:**
- Modify: `src/pages/profile/edit.vue`
- Modify: `src/styles/secondary-pages-light.scss`
- Test: `src/utils/__tests__/profile-pages-layout.test.ts`
- Test: `src/utils/__tests__/profile-presentation.test.ts`

**Interfaces:**
- Consumes: profile option arrays, label helpers, and normalization helpers from Task 1.
- Produces: A form-only profile editor that saves existing API code values.

- [ ] **Step 1: Remove duplicate navigation dependencies and state**

Remove body-metric imports, loading, metric formatting, navigation prompt state, navigation functions, link markup, and prompt markup.

- [ ] **Step 2: Normalize loaded values and render labels**

```ts
goal.value = normalizeProfileGoal(profileStore.trainingGoal)
level.value = normalizeProfileExperience(profileStore.experienceLevel)
```

The hero uses `profileGoalLabel(goal)` and `profileExperienceLabel(level)`; it never prints backend codes directly.

- [ ] **Step 3: Render options by code and label**

```vue
<view v-for="item in PROFILE_GOAL_OPTIONS" :key="item.value" @tap="selectGoal(item.value)">
  <text>{{ item.label }}</text>
  <text v-if="goal === item.value" class="profile-edit__choice-check">已选</text>
</view>
```

Use the same pattern for experience. Remove the text-glyph avatar badge and show “更换头像”.

- [ ] **Step 4: Clarify save status**

Render “保存中...”, “保存资料”, or “已保存” from `saving` and `formDirty`, while preserving the existing disabled behavior.

- [ ] **Step 5: Update light-theme selectors and delete unused link/prompt styles**

Remove selectors for deleted elements and keep active option contrast compatible with the existing light theme.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `npm run test:run -- src/utils/__tests__/training-level-presentation.test.ts src/utils/__tests__/profile-presentation.test.ts src/utils/__tests__/profile-pages-layout.test.ts`

Expected: PASS.

### Task 4: Verification and visual QA

**Files:**
- Create or update only if visual comparison is available: `design-qa.md`

**Interfaces:**
- Consumes: Completed pages from Tasks 2 and 3.
- Produces: Verified H5 and WeChat Mini Program output.

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:run`

Expected: all tests PASS with no unhandled errors.

- [ ] **Step 2: Run formatting and type checks**

Run: `npm run format:check && npm run typecheck`

Expected: both commands exit 0.

- [ ] **Step 3: Build the WeChat Mini Program**

Run: `npm run build:mp-weixin`

Expected: build exits 0 and the app ID sync script completes.

- [ ] **Step 4: Start H5 and inspect at a mobile viewport**

Run: `npm run dev:h5 -- --host 0.0.0.0`

Inspect the profile page, open the level sheet, and open profile editing. Verify no horizontal clipping, no nested tap target, visible selected states, and fixed bottom actions.

- [ ] **Step 5: Compare with the supplied screenshots and record the result**

Create `design-qa.md` only after both reference and implementation captures can be inspected together. The final line must be `final result: passed` or `final result: blocked`.
