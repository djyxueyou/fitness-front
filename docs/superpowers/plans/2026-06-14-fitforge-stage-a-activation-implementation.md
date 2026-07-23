# FitForge Stage A Activation Implementation Plan

> 已停止执行：训练画像与画像推荐已于 2026-07-19 从产品和代码中删除。请勿继续按本文恢复相关功能。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让未启用计划的用户通过四步画像获得可解释的系统计划推荐，顺利完成首训，同时移除基础训练保存的会员阻断并补齐数据管理入口。

**Architecture:** 复用现有用户、计划、训练和会员模块。新增画像与计划匹配能力，但推荐结果只引用现有系统计划；前端增加独立首次画像页面和状态 Store。事件埋点先通过统一前端事件客户端落地，不阻塞业务请求。

**Tech Stack:** uni-app、Vue 3、TypeScript、Pinia、Spring Boot、MyBatis Plus、MySQL、JUnit 5。

---

## File Map

### Frontend

- Create: `src/api/onboarding.ts` — 画像与推荐接口契约。
- Create: `src/api/product-event.ts` — 非阻断式产品事件上报。
- Create: `src/stores/onboarding.ts` — 画像草稿、推荐结果和恢复状态。
- Create: `src/pages/onboarding/training-profile.vue` — 四步画像。
- Create: `src/pages/onboarding/recommended-plan.vue` — 推荐结果与启用。
- Create: `src/pages/profile/data-privacy.vue` — 数据导出、删除和注销入口。
- Modify: `src/pages.json` — 注册新增页面。
- Modify: `src/pages/home/index.vue` — 新增画像和推荐状态主行动。
- Modify: `src/pages/home/workout-active.vue` — 移除基础保存会员阻断。
- Modify: `src/pages/profile/settings.vue` — 增加数据与隐私入口。
- Modify: `src/utils/navigation.ts` — 新增路由常量。

### Backend

- Create: `modules/user/dto/TrainingProfileResponse.java`
- Create: `modules/user/dto/UpsertTrainingProfileRequest.java`
- Create: `modules/plan/dto/RecommendedPlanResponse.java`
- Create: `modules/plan/service/PlanMatchingService.java`
- Create: `modules/analytics/controller/ProductEventController.java`
- Create: `modules/analytics/dto/ProductEventRequest.java`
- Create: `modules/user/service/UserDataManagementService.java`
- Modify: `modules/user/controller/UserController.java`
- Modify: `modules/plan/controller/TrainingPlanController.java`
- Modify: `modules/user/entity/User.java`
- Modify: `src/main/resources/db/schema.sql`
- Create: `src/main/resources/db/migration/20260614_training_profile_and_product_event.sql`

### Tests

- Create: `src/test/java/com/liftlog/modules/plan/PlanMatchingServiceTest.java`
- Create: `src/test/java/com/liftlog/modules/user/UserDataManagementServiceTest.java`
- Modify: `src/test/java/com/liftlog/modules/user/UserProfileServiceTest.java`
- Modify: `src/test/java/com/liftlog/schema/SchemaSmokeTest.java`

## Task 1: Add Training Profile Persistence

- [ ] Add profile fields to `user` storage: goal, sessions per week, duration, preferred days JSON, environment, equipment JSON, limitations JSON, onboarding status.
- [ ] Add matching fields to `User`, request DTO and response DTO.
- [ ] Implement `GET /api/user/training-profile` and `PUT /api/user/training-profile`.
- [ ] Reject invalid frequency outside 2–5 and duration outside 30/45/60/75.
- [ ] Write service tests for partial draft save, completed profile and invalid input.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=UserProfileServiceTest,SchemaSmokeTest" test
```

Expected: all selected tests pass.

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/user src/main/resources/db src/test/java/com/liftlog/modules/user src/test/java/com/liftlog/schema
git commit -m "feat: add training onboarding profile"
```

## Task 2: Implement Explainable System Plan Matching

- [ ] Add `PlanMatchingService` that loads enabled system plans and scores goal, frequency, difficulty and estimated duration.
- [ ] Return at most three plans with rank, score, reasons, cautions and recommended activation mode.
- [ ] Keep recommendations read-only and reference existing `planId`.
- [ ] Add `GET /api/user/plans/recommended`.
- [ ] Cover exact match, partial match, no matching equipment and incomplete profile in tests.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=PlanMatchingServiceTest,TrainingPlanServiceTest" test
```

Expected: recommendation tests and existing plan tests pass.

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/plan src/test/java/com/liftlog/modules/plan
git commit -m "feat: recommend system training plans"
```

## Task 3: Build Four-Step Onboarding Flow

- [ ] Define `TrainingProfile` and `RecommendedPlan` in `src/api/onboarding.ts`.
- [ ] Implement `useOnboardingStore` with server draft loading, per-step save and recommendation refresh.
- [ ] Add four-step page using existing header, card, chip and primary button components.
- [ ] Restore the first incomplete step after leaving the page.
- [ ] Mark recommendations stale when an already-completed answer changes.
- [ ] Add recommendation results page with reasons, cautions, first-week preview and activation mode.
- [ ] Register routes and navigation constants.
- [ ] Verify:

```powershell
npm run typecheck
npm run build:h5
npm run build:mp-weixin
```

Expected: all commands exit successfully.

- [ ] Commit:

```powershell
git add src/api/onboarding.ts src/stores/onboarding.ts src/pages/onboarding src/pages.json src/utils/navigation.ts
git commit -m "feat: add guided training onboarding"
```

## Task 4: Integrate Home State Priority

- [ ] Load onboarding status alongside existing plan recommendation and workout draft.
- [ ] Preserve priority: recoverable draft, today's plan, overdue plan, onboarding, recommended plan, plan selection, completed state.
- [ ] Use exactly one primary CTA for every state.
- [ ] Return from login to the intended onboarding or recommendation page.
- [ ] Verify logged-out, partial profile, recommended-not-active and active-plan states in H5.
- [ ] Run:

```powershell
npm run typecheck
npm run build:h5
```

- [ ] Commit:

```powershell
git add src/pages/home/index.vue src/utils/auth-bootstrap.ts
git commit -m "feat: guide unplanned users from home"
```

## Task 5: Remove Basic Workout Save Paywall

- [ ] Remove membership checks that block `saveTraining()` in `workout-active.vue`.
- [ ] Keep membership prompts only on explicitly Pro capabilities.
- [ ] Confirm repeated free-user saves still use existing `clientRequestId`.
- [ ] Verify three consecutive free-user workouts can be saved.
- [ ] Run:

```powershell
npm run typecheck
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/pages/home/workout-active.vue src/utils/membership-guard.ts src/stores/membership-prompt.ts
git commit -m "fix: allow unlimited basic workout saves"
```

## Task 6: Add Non-Blocking Product Events

- [ ] Define an allowlisted product event request containing name, source page, platform, app version, occurred time and structured properties.
- [ ] Store events through a backend endpoint without accepting notes or arbitrary personal text.
- [ ] Make frontend event delivery fire-and-forget and swallow reporting failures.
- [ ] Instrument onboarding started/completed, recommendation viewed/activated and first workout started/completed.
- [ ] Add controller validation tests.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml test
npm run typecheck
```

- [ ] Commit:

```powershell
git add src/api/product-event.ts src/pages/onboarding src/pages/home src/main/java/com/liftlog/modules/analytics src/main/resources/db
git commit -m "feat: track activation product events"
```

## Task 7: Add Data and Privacy Actions

- [ ] Add backend endpoints for training export, body metrics export, training-data deletion and account deletion request.
- [ ] Export CSV using existing training and body-metric query services.
- [ ] Require confirmation for destructive operations and keep account deletion separate from training-data deletion.
- [ ] Add `data-privacy.vue` with progress, success and failure states.
- [ ] On account deletion success, clear token, profile cache, onboarding draft and workout draft.
- [ ] Add backend service tests for export contents and delete scope.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=UserDataManagementServiceTest,TrainingQueryServiceTest" test
npm run typecheck
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/pages/profile/data-privacy.vue src/pages/profile/settings.vue src/pages.json src/api/user.ts src/main/java/com/liftlog/modules/user src/test/java/com/liftlog/modules/user
git commit -m "feat: add user data management"
```

## Task 8: Stage A Verification

- [ ] Run backend suite:

```powershell
mvn -f fitness-server/pom.xml test
```

- [ ] Run frontend verification:

```powershell
npm run verify
npm run build:h5
npm run build:app-plus
```

- [ ] Manually verify: new user onboarding, recommendation activation, first workout completion, repeated free saves, export, training deletion and account deletion confirmation.
- [ ] Confirm metrics can calculate onboarding completion and 24-hour first-workout completion.
