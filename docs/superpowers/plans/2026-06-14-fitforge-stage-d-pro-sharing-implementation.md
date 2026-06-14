# FitForge Stage D Pro and Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用真实训练洞察建立清晰的 Pro 价值，并增加默认保护隐私的训练总结、周复盘和计划分享能力。

**Architecture:** 高级分析继续复用现有训练分析模块并增加洞察聚合层；会员状态和支付流程保持不变，只调整权益判断和价值呈现。分享使用短期只读令牌引用现有训练或计划，不复制敏感训练数据到公开页面。

**Tech Stack:** uni-app、Vue 3、TypeScript、Pinia、Spring Boot、MyBatis Plus、MySQL、JUnit 5。

---

## File Map

### Frontend

- Create: `src/api/insights.ts`
- Create: `src/api/share.ts`
- Create: `src/components/pro-value-explainer/index.vue`
- Create: `src/components/share-card-sheet/index.vue`
- Create: `src/pages/plan/shared-preview.vue`
- Modify: `src/pages/home/volume-trend.vue`
- Modify: `src/pages/home/workout-summary.vue`
- Modify: `src/pages/home/weekly-review.vue`
- Modify: `src/pages/profile/membership.vue`
- Modify: `src/stores/membership.ts`
- Modify: `src/utils/membership-guard.ts`
- Modify: `src/pages.json`

### Backend

- Create: `modules/training/dto/AdvancedAnalyticsSummaryResponse.java`
- Create: `modules/training/dto/AnalyticsInsightResponse.java`
- Create: `modules/training/service/TrainingInsightService.java`
- Create: `modules/share/controller/ShareController.java`
- Create: `modules/share/dto/CreateShareRequest.java`
- Create: `modules/share/dto/SharedPlanResponse.java`
- Create: `modules/share/service/ShareService.java`
- Create: `modules/share/entity/ShareToken.java`
- Create: `modules/share/mapper/ShareTokenMapper.java`
- Modify: `modules/training/controller/TrainingAnalyticsController.java`
- Modify: `modules/membership/service/MembershipService.java`
- Modify: `src/main/resources/db/schema.sql`
- Create: `src/main/resources/db/migration/20260614_share_token_and_pro_entitlement.sql`

### Tests

- Create: `src/test/java/com/liftlog/modules/training/TrainingInsightServiceTest.java`
- Create: `src/test/java/com/liftlog/modules/share/ShareServiceTest.java`
- Modify: `src/test/java/com/liftlog/modules/membership/MembershipServiceTest.java`
- Modify: `src/test/java/com/liftlog/schema/SchemaSmokeTest.java`

## Task 1: Define Free and Pro Entitlements

- [ ] Centralize entitlement codes for advanced recommendations, advanced analytics, unlimited custom plans/templates and automated export.
- [ ] Keep basic workout save, system plans, recent records and basic weekly stats free.
- [ ] Return entitlement availability with membership status.
- [ ] Remove scattered feature assumptions from controllers and keep checks in membership service.
- [ ] Test free, trial, active, expired and backend-failure-safe behavior.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=MembershipServiceTest" test
```

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/membership src/test/java/com/liftlog/modules/membership
git commit -m "refactor: centralize membership entitlements"
```

## Task 2: Build Advanced Insight Aggregation

- [ ] Add advanced summary with headline, highlights, attention items and data readiness.
- [ ] Reuse existing dashboard, weekly volume, muscle distribution, exercise trend and PR data.
- [ ] Implement platform detection only when an exercise has at least four valid records and the latest three show no meaningful gain.
- [ ] Never auto-edit plans from insights.
- [ ] Add `GET /api/trainings/analytics/advanced-summary`.
- [ ] Test sufficient data, insufficient data, improvement and possible plateau states.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=TrainingInsightServiceTest,TrainingAnalyticsServiceTest" test
```

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/training src/test/java/com/liftlog/modules/training
git commit -m "feat: add advanced training insights"
```

## Task 3: Redesign Analysis Experience

- [ ] Keep basic weekly stats and recent trends visible to free users.
- [ ] Place conclusion and next action before charts.
- [ ] Show data-readiness messages instead of empty locked charts.
- [ ] Open `pro-value-explainer` before navigating to membership.
- [ ] Limit repeated automatic Pro prompts to once per benefit type every seven days.
- [ ] Run:

```powershell
npm run typecheck
npm run build:h5
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/api/insights.ts src/components/pro-value-explainer src/pages/home/volume-trend.vue src/utils/membership-guard.ts src/stores/membership.ts
git commit -m "feat: present actionable advanced analysis"
```

## Task 4: Redesign Membership Value Presentation

- [ ] Select one truthful value summary based on user data readiness.
- [ ] Show three primary Pro outcomes before the feature comparison.
- [ ] Preserve existing membership plans, order creation and payment behavior.
- [ ] Add entry-point context so the page can explain the capability the user attempted to open.
- [ ] Track paywall view, trial start and paid conversion source.
- [ ] Run:

```powershell
npm run typecheck
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/pages/profile/membership.vue src/stores/membership.ts src/api/product-event.ts
git commit -m "feat: clarify membership value"
```

## Task 5: Implement Privacy-Safe Share Tokens

- [ ] Add share tokens for workout summary, weekly review and plan preview.
- [ ] Store resource type, resource ID, owner ID, expiry and allowed fields.
- [ ] Default workout and weekly shares to hide volume, exact weights, cultivation, body metrics, notes and limitations.
- [ ] Expose only read-only plan preview data for shared plans.
- [ ] Allow logged-in recipients to copy a shared plan using existing copy-plan behavior.
- [ ] Test expired token, deleted resource, unauthorized fields and plan copy independence.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=ShareServiceTest,TrainingPlanServiceTest,SchemaSmokeTest" test
```

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/share src/main/resources/db src/test/java/com/liftlog/modules/share src/test/java/com/liftlog/schema
git commit -m "feat: add privacy-safe sharing"
```

## Task 6: Build Share Card and Shared Plan UI

- [ ] Add share sheet with privacy toggles and a live preview.
- [ ] Add workout summary and weekly review share actions.
- [ ] Generate cards using existing real metrics and brand assets; do not include hidden fields in the rendered image.
- [ ] Add shared plan preview and copy action.
- [ ] Handle image generation and platform sharing failures with retry.
- [ ] Run:

```powershell
npm run typecheck
npm run build:h5
npm run build:mp-weixin
npm run build:app-plus
```

- [ ] Commit:

```powershell
git add src/api/share.ts src/components/share-card-sheet src/pages/home/workout-summary.vue src/pages/home/weekly-review.vue src/pages/plan/shared-preview.vue src/pages.json
git commit -m "feat: share workouts reviews and plans"
```

## Task 7: Instrument Commercial and Sharing Funnel

- [ ] Track advanced preview/open, value explanation, paywall, trial and purchase events.
- [ ] Track share-card create/share and shared-plan open/copy.
- [ ] Ensure events contain share type and entry point, not private training values.
- [ ] Verify product-event failures do not block purchase or sharing.
- [ ] Commit:

```powershell
git add src/api/product-event.ts src/pages/home src/pages/profile/membership.vue src/pages/plan/shared-preview.vue
git commit -m "feat: measure pro and sharing funnel"
```

## Task 8: Stage D Verification

- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml test
npm run verify
npm run build:h5
npm run build:app-plus
```

- [ ] Manually verify free and Pro analysis states, data-readiness states, prompt frequency, existing payment flow, default share privacy, expired links and copied-plan independence.
- [ ] Confirm basic workout saving remains free and no public social feed was introduced.

