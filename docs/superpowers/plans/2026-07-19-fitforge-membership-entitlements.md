# FitForge Membership Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement membership scheme A with no automatic trial, Pro-only favorites and weekly statistics, one free custom exercise, one free custom training template, and unlimited core workout recording.

**Architecture:** The backend remains the authority for active membership and content quotas. Frontend guards provide clear prompts, but every protected read/write endpoint validates entitlement; per-user row locking serializes free-tier create operations so concurrent requests cannot exceed one active custom item.

**Tech Stack:** uni-app, Vue 3, TypeScript, Pinia, Vitest, Spring Boot 4, Java 17, MyBatis-Plus, MySQL, Maven

## Global Constraints

- Free users can create at most 1 enabled custom exercise and 1 user template; deleting one releases the corresponding quota.
- Pro users have unlimited custom exercises and templates.
- Favorites and all weekly aggregate/review data are Pro-only.
- Single-workout history/detail and plan execution dates/day completion states remain free.
- Login must not create a membership row or begin a trial.
- Membership expiry never deletes favorites, exercises, templates, or historical references.
- An expired user with more than the free quota may view and delete custom content but may not create, copy, or edit until under quota or Pro is restored.
- Core workout start/save/history is unlimited and must not invoke a membership guard.
- Existing share-card previews may remain, but weekly-review preview must not bypass the weekly-stat entitlement.
- Preserve unrelated dirty-worktree changes and synchronize docs/comments with each behavior change.

---

## File Structure

- `MembershipService` owns paid status only; it no longer creates trials.
- Exercise and template command services own their content counts and use `UserMapper.selectByIdForUpdate` for serialized quota checks.
- Favorite query/write services call `MembershipService.requireActive` before reading or mutating favorite relations.
- `WeeklyReviewService` gates its aggregation so controller and share-preview callers cannot bypass Pro.
- `TrainingAnalyticsController` gates dashboard and all aggregate endpoints.
- Frontend `ApiError` preserves backend business codes, allowing quota failures to open the correct paywall.
- Frontend membership utilities centralize limit `1` and entitlement-error handling.

### Task 1: Remove automatic trials from backend, schema, and frontend status

**Files:**

- Modify: `fitness-server/src/main/java/com/liftlog/modules/auth/service/AuthService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/membership/service/MembershipService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/membership/entity/UserMembership.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/membership/dto/MembershipStatusResponse.java`
- Create: `fitness-server/src/main/resources/db/migration/20260719_remove_membership_trial.sql`
- Modify: `fitness-server/src/main/resources/db/schema.sql`
- Test: `fitness-server/src/test/java/com/liftlog/modules/auth/AuthServiceTest.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/membership/MembershipServiceTest.java`
- Modify: `fitness-front/src/api/membership.ts`
- Modify: `fitness-front/src/stores/membership.ts`
- Modify: `fitness-front/src/pages/profile/membership.vue`

**Interfaces:**

- Produces `MembershipStatusResponse(active, expired, planCode, membershipExpiresAt, remainingDays)` where `planCode` is nullable and a never-paid free user has `expired=false`.
- `status(userId)` returns an inactive response when no row exists.
- `extendMembership` inserts a row on first successful payment and updates a row on renewal.

- [ ] **Step 1: Add failing no-trial tests**

In `AuthServiceTest`, verify login never calls membership creation:

```java
verifyNoInteractions(membershipService);
```

In `MembershipServiceTest`, add:

```java
@Test
void shouldReturnFreeStatusWithoutCreatingMembership() {
    when(userMembershipMapper.selectByUserId(7L)).thenReturn(null);

    MembershipStatusResponse status = membershipService.status(7L);

    assertFalse(status.active());
    assertFalse(status.expired());
    assertEquals(0L, status.remainingDays());
    verify(userMembershipMapper, never()).insert(any());
}
```

Store the mapper mocks as test fields so they can be stubbed and verified.

- [ ] **Step 2: Run tests and verify old trial behavior fails**

```bash
cd fitness-server
mvn -Dtest=AuthServiceTest,MembershipServiceTest test
```

Expected: failure because login/status still call `ensureTrialMembership`.

- [ ] **Step 3: Remove trial code and make paid extension upsert**

Delete `MembershipService` from `AuthService` constructor and remove the login call. Delete `TRIAL_PLAN_CODE`, `TRIAL_DAYS`, and `ensureTrialMembership`.

Implement null-safe status and first-purchase creation:

```java
public MembershipStatusResponse status(Long userId) {
    return toStatus(userMembershipMapper.selectByUserId(userId));
}

@Transactional
public void extendMembership(Long userId, MembershipPlan plan, LocalDateTime paidAt) {
    UserMembership membership = userMembershipMapper.selectByUserId(userId);
    if (membership == null) {
        membership = new UserMembership();
        membership.setUserId(userId);
        membership.setMembershipExpiresAt(paidAt.plusMonths(plan.getDurationMonths()));
        membership.setLastPlanCode(plan.getPlanCode());
        userMembershipMapper.insert(membership);
        return;
    }
    LocalDateTime base = membership.getMembershipExpiresAt() != null
        && membership.getMembershipExpiresAt().isAfter(paidAt)
        ? membership.getMembershipExpiresAt() : paidAt;
    membership.setMembershipExpiresAt(base.plusMonths(plan.getDurationMonths()));
    membership.setLastPlanCode(plan.getPlanCode());
    userMembershipMapper.updateById(membership);
}
```

Remove trial fields from entity/DTO and make `toStatus(null)` return inactive, not expired, null plan/expiry, and zero days. Only a persisted membership with a past expiry is `expired=true`.

- [ ] **Step 4: Drop trial columns and align schema**

```sql
ALTER TABLE user_membership
    DROP COLUMN trial_started_at,
    DROP COLUMN trial_ends_at;
```

Remove the columns from `schema.sql`; keep `membership_expires_at` and `last_plan_code`.

- [ ] **Step 5: Remove trial fields and copy from frontend**

Delete `trial` and `trialEndsAt` from `MembershipStatusResponse`, and make `planCode` optional. Status labels become:

```ts
if (!status.value) return '会员状态加载中'
if (status.value.active) return `Pro 剩余 ${status.value.remainingDays} 天`
return '当前为免费版'
```

Remove “30 天试用”, `TRIAL`, trial countdown, and claims that free users can save only once per week. Membership copy must say core recording/history are unlimited.

Update `MembershipService.valueExplanation` and its tests with explicit entry points `exercise_favorite`, `custom_exercise`, `custom_template`, and `weekly_stats`. The default explanation must sell creation, statistics, and insight—not “more complete training records”.

- [ ] **Step 6: Run tests and frontend typecheck**

```bash
cd fitness-server
mvn -Dtest=AuthServiceTest,MembershipServiceTest test
cd ../fitness-front
npm run typecheck
```

Expected: backend tests and frontend typecheck pass.

- [ ] **Step 7: Commit trial removal separately in each repository**

Use `git add` with only the files listed in this task, then commit backend as `refactor: remove automatic membership trial` and frontend as `refactor: remove membership trial UI`.

### Task 2: Preserve membership business codes in frontend API errors

**Files:**

- Modify: `fitness-front/src/api/http.ts`
- Create: `fitness-front/src/utils/membership-entitlements.ts`
- Create: `fitness-front/src/utils/__tests__/membership-entitlements.test.ts`
- Modify: `fitness-server/src/main/java/com/liftlog/common/api/ApiCode.java`
- Modify: `fitness-server/src/main/java/com/liftlog/common/exception/GlobalExceptionHandler.java`
- Test: `fitness-server/src/test/java/com/liftlog/common/exception/GlobalExceptionHandlerTest.java`

**Interfaces:**

- Produces `ApiError(code: number, message: string, statusCode?: number)`.
- Produces `isMembershipRequiredError(error: unknown): boolean`.
- Produces constants `FREE_CUSTOM_EXERCISE_LIMIT = 1` and `FREE_CUSTOM_TEMPLATE_LIMIT = 1`.

- [ ] **Step 1: Add frontend entitlement utility tests**

```ts
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/http'
import {
  canCreateCustomContent,
  isMembershipRequiredError
} from '@/utils/membership-entitlements'

describe('membership entitlements', () => {
  it('allows one free item and blocks the second', () => {
    expect(canCreateCustomContent(false, 0, 1)).toBe(true)
    expect(canCreateCustomContent(false, 1, 1)).toBe(false)
    expect(canCreateCustomContent(true, 99, 1)).toBe(true)
  })

  it('recognizes membership business errors', () => {
    expect(isMembershipRequiredError(new ApiError(40311, '会员功能'))).toBe(true)
    expect(isMembershipRequiredError(new Error('network'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test and verify missing exports fail**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/membership-entitlements.test.ts
```

Expected: failure because `ApiError` and utility do not exist.

- [ ] **Step 3: Implement typed API errors and membership helpers**

Add:

```ts
export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
```

Throw `ApiError(body.code, message, response.statusCode)` for HTTP and non-zero business responses. Keep `AuthExpiredError` behavior unchanged.

Implement the utility with exact limits and `error instanceof ApiError && error.code === 40311`.

- [ ] **Step 4: Make membership errors HTTP 403 and remove the obsolete workout-limit code**

Delete `TRAINING_WEEKLY_LIMIT_REACHED` after confirming it has no callers. Change `statusFromCode` so `FORBIDDEN` and `MEMBERSHIP_REQUIRED` return `HttpStatus.FORBIDDEN`.

- [ ] **Step 5: Run focused tests**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/membership-entitlements.test.ts
cd ../fitness-server
mvn -Dtest=GlobalExceptionHandlerTest test
```

Expected: all selected tests pass.

### Task 3: Enforce Pro favorites and one-free custom exercise

**Files:**

- Modify: `fitness-server/src/main/java/com/liftlog/modules/user/mapper/UserMapper.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/exercise/mapper/ExerciseMapper.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/exercise/service/ExerciseCommandService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/exercise/service/ExerciseFavoriteService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/exercise/service/ExerciseQueryService.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/exercise/ExerciseCommandServiceTest.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/exercise/ExerciseFavoriteServiceTest.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/exercise/ExerciseQueryServiceTest.java`

**Interfaces:**

- Produces `UserMapper.selectByIdForUpdate(Long userId)`.
- Produces `ExerciseMapper.countEnabledCustomByOwnerUserId(Long userId)`.
- Free create/edit rules use limit `1`; delete remains available.

- [ ] **Step 1: Add failing service tests for favorite reads/writes and exercise quota**

Cover these cases explicitly:

```java
verify(membershipService).requireActive(1L, "动作收藏");
```

for favorite, unfavorite, and favorites list; and:

```java
when(membershipService.isActive(1L)).thenReturn(false);
when(exerciseMapper.countEnabledCustomByOwnerUserId(1L)).thenReturn(0L, 1L);
```

Assert first free create succeeds, second throws `MEMBERSHIP_REQUIRED`, Pro create succeeds, a free user with one item can edit it, and an expired over-quota user cannot edit until count is at most one. Assert delete never requires membership.

- [ ] **Step 2: Run exercise tests and verify failures**

```bash
cd fitness-server
mvn -Dtest=ExerciseCommandServiceTest,ExerciseFavoriteServiceTest,ExerciseQueryServiceTest test
```

Expected: failures because custom creation is fully gated and favorite unfavorite/list are not fully gated.

- [ ] **Step 3: Add row locking and enabled-custom count queries**

```java
@Select("SELECT * FROM user WHERE id = #{userId} FOR UPDATE")
User selectByIdForUpdate(Long userId);
```

```java
@Select("""
    SELECT COUNT(*) FROM exercise
    WHERE owner_user_id = #{userId}
      AND scope = 'USER'
      AND is_enabled = 1
    """)
Long countEnabledCustomByOwnerUserId(Long userId);
```

- [ ] **Step 4: Replace the all-or-nothing exercise membership guard**

Inside the existing transactional create method, lock the user row, check active membership, and for free users reject count `>= 1` with `ApiCode.MEMBERSHIP_REQUIRED`. For update, allow active members or users whose current enabled count is `<= 1`; reject expired over-quota users. Keep delete available and keep its reference-safety validation.

Use a helper with a business comment:

```java
private void requireCustomExerciseWrite(Long userId, boolean creating) {
    userMapper.selectByIdForUpdate(userId);
    if (membershipService.isActive(userId)) return;
    long count = nullToZero(exerciseMapper.countEnabledCustomByOwnerUserId(userId));
    boolean denied = creating ? count >= FREE_CUSTOM_EXERCISE_LIMIT : count > FREE_CUSTOM_EXERCISE_LIMIT;
    if (denied) {
        throw new BizException(ApiCode.MEMBERSHIP_REQUIRED.code(), "免费版最多保留 1 个自定义动作");
    }
}
```

- [ ] **Step 5: Gate all favorite operations**

Call `membershipService.requireActive(userId, "动作收藏")` before favorite, unfavorite, and list queries. Keep favorite/unfavorite idempotency after the entitlement check.

- [ ] **Step 6: Run exercise tests**

Run the command from Step 2. Expected: all selected tests pass.

### Task 4: Enforce one-free custom template across every creation path

**Files:**

- Modify: `fitness-server/src/main/java/com/liftlog/modules/template/mapper/TrainingTemplateMapper.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/template/service/TemplateCommandService.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/template/TemplateCommandServiceTest.java`

**Interfaces:**

- Produces `TrainingTemplateMapper.countUserTemplates(Long userId)`.
- Applies the same quota to create, copy, and create-from-training.

- [ ] **Step 1: Add failing quota tests for all template paths**

Test create, `copy`, and `createFromTraining` with free count 0/1, Pro active, and expired over-quota edit. Verify delete remains allowed.

- [ ] **Step 2: Run the template test and verify it fails under the old full membership gate**

```bash
cd fitness-server
mvn -Dtest=TemplateCommandServiceTest test
```

- [ ] **Step 3: Add template count and replace guards**

Count only `template_type = 'USER'` rows owned by the user. Use the same `UserMapper.selectByIdForUpdate` transaction lock as custom exercises. Apply create quota to `create`, `copy`, and `createFromTraining`; apply edit rule to `update`; do not membership-gate delete.

```java
private static final int FREE_CUSTOM_TEMPLATE_LIMIT = 1;
```

Reject with `MEMBERSHIP_REQUIRED` and message `免费版最多保留 1 个自定义训练模板`.

- [ ] **Step 4: Run template tests**

Expected: all selected template tests pass.

### Task 5: Put dashboard and weekly review entirely behind Pro

**Files:**

- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/controller/TrainingAnalyticsController.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/service/WeeklyReviewService.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/training/WeeklyReviewServiceTest.java`
- Create: `fitness-server/src/test/java/com/liftlog/modules/training/TrainingAnalyticsControllerTest.java`
- Modify: `fitness-server/src/test/java/com/liftlog/modules/share/SharePreviewServiceTest.java`

**Interfaces:**

- Dashboard and every analytics aggregate require active membership.
- `WeeklyReviewService.weeklyReview` itself requires membership, protecting direct share-preview calls.

- [ ] **Step 1: Add failing entitlement tests**

For dashboard, verify `membershipService.requireActive(userId, "训练周统计")` runs before analytics service. For weekly review, verify the same call before mappers execute. Update share-preview tests to provide active membership through the weekly-review dependency or assert free weekly preview is rejected.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
cd fitness-server
mvn -Dtest=TrainingAnalyticsControllerTest,WeeklyReviewServiceTest,SharePreviewServiceTest test
```

- [ ] **Step 3: Gate weekly data at both boundaries**

Remove the “free analysis baseline” comment and add the membership check to `/dashboard`. Inject `MembershipService` into `WeeklyReviewService` and call:

```java
membershipService.requireActive(userId, "训练周统计");
```

at the start of `weeklyReview` before any aggregation. Do not gate plan execution summary endpoints or individual training history/detail endpoints.

- [ ] **Step 4: Run focused tests**

Expected: analytics, weekly review, and share preview tests pass.

### Task 6: Implement frontend quota UX, Pro favorites, and Pro weekly-stat screens

**Files:**

- Modify: `fitness-front/src/utils/membership-guard.ts`
- Modify: `fitness-front/src/stores/membership-prompt.ts`
- Modify: `fitness-front/src/stores/exercise.ts`
- Modify: `fitness-front/src/pages/exercises/index.vue`
- Modify: `fitness-front/src/components/exercise-picker/index.vue`
- Modify: `fitness-front/src/pages/exercises/detail.vue`
- Modify: `fitness-front/src/pages/profile/favorites.vue`
- Modify: `fitness-front/src/pages/home/template-edit.vue`
- Modify: `fitness-front/src/pages/home/template-detail.vue`
- Modify: `fitness-front/src/pages/home/select-template.vue`
- Modify: `fitness-front/src/pages/profile/template-manager.vue`
- Modify: `fitness-front/src/pages/home/workout-summary.vue`
- Modify: `fitness-front/src/pages/home/volume-trend.vue`
- Modify: `fitness-front/src/pages/home/weekly-review.vue`
- Modify: `fitness-front/src/pages/home/index.vue`
- Test: `fitness-front/src/utils/__tests__/membership-entitlements.test.ts`
- Create: `fitness-front/src/utils/__tests__/membership-page-contract.test.ts`

**Interfaces:**

- Free creation opens the editor when current count is 0 and opens the Pro prompt at count 1.
- Edit stays available at count 1; over-quota edit opens Pro.
- Weekly pages fetch no user statistics before active status is confirmed.

- [ ] **Step 1: Extend frontend tests with page-contract assertions**

Read source files and assert:

```ts
expect(membershipPage).not.toMatch(/试用|每周保存次数有限|每周可保存 1 次/)
expect(homePage).toContain('查看 Pro 周统计')
expect(weeklyReviewPage).toContain("ensureMembershipFeature('训练周统计'")
```

Also test quota helper behavior for create and edit-over-quota.

- [ ] **Step 2: Run tests and verify old copy/guards fail**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/membership-entitlements.test.ts src/utils/__tests__/membership-page-contract.test.ts
```

- [ ] **Step 3: Centralize quota prompt behavior**

Use current custom-item counts from exercise/template stores. Creation flow:

```ts
if (!canCreateCustomContent(membershipStore.active, customCount.value, 1)) {
  await membershipPromptStore.open('自定义动作', '免费版最多创建 1 个自定义动作。', 'custom_exercise')
  return
}
```

Do not call `ensureMembershipFeature` before the first free create. Catch `isMembershipRequiredError` after all create/copy/save-from-training requests and open the same prompt so direct/deep-link operations remain understandable.

- [ ] **Step 4: Keep favorites strictly Pro**

Before toggling favorites, call `ensureMembershipFeature('动作收藏', 'exercise_favorite')`. On the favorites page, do not redirect free users home; render an in-page locked state with a “查看 Pro 权益” action and do not call `refreshFavoriteStates` until active status is confirmed.

- [ ] **Step 5: Gate analytics and weekly review before data fetch**

`volume-trend.vue` and `weekly-review.vue` must check membership first. Free users see a Pro preview with no real metrics. Do not call dashboard, weekly review, weekly volume, muscle distribution, PR, or insight endpoints when inactive.

On home, replace the logged-in free weekly numeric panel with a locked Pro card. Active members keep the real weekly panel. Keep today’s plan card and individual plan-day completion states visible to free users.

- [ ] **Step 6: Correct membership page value copy**

The final benefit list must state:

- 动作收藏：Pro unlimited.
- 自定义动作：free 1, Pro unlimited.
- 自定义模板：free 1, Pro unlimited.
- 周统计与周报：Pro.
- Training save/history: unlimited for both tiers.

Remove all trial and weekly-save-limit copy.

- [ ] **Step 7: Run frontend verification**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/membership-entitlements.test.ts src/utils/__tests__/membership-page-contract.test.ts
npm run typecheck
npm run build:mp-weixin
```

Expected: tests, typecheck, and build pass.

### Task 7: Synchronize membership documentation and complete subsystem verification

**Files:**

- Modify: `PRODUCT.md`
- Modify: `fitness-front/docs/superpowers/specs/2026-06-14-fitforge-product-optimization-master-design.md`
- Modify: `fitness-front/docs/superpowers/specs/2026-06-14-fitforge-pro-membership-sharing-design.md`
- Modify: `fitness-server/README.md`
- Modify: `fitness-server/src/main/resources/db/schema.sql`

- [ ] **Step 1: Mark old membership/trial/free-weekly-stat rules as superseded**

Add a status notice pointing to the approved 2026-07-19 redesign. Do not rewrite historical decision records as though they never existed.

- [ ] **Step 2: Update current product and backend docs**

Document the exact free/Pro matrix, quota semantics, no-trial login, weekly-stat endpoint protection, asset retention after expiry, and unlimited workout recording.

- [ ] **Step 3: Run stale-rule searches**

```bash
rg -n "TRIAL_DAYS|TRIAL_PLAN_CODE|ensureTrialMembership|每周保存次数有限|每周可保存 1 次|dashboard is the free" fitness-front/src fitness-server/src/main/java fitness-server/src/test PRODUCT.md
rg -n "trial_started_at|trial_ends_at" fitness-server/src/main/resources/db/schema.sql
```

Expected: no matches. Historical migration `20260513_membership_payment.sql` may still contain the original create columns because the new migration removes them in sequence.

- [ ] **Step 4: Run full membership-related verification**

```bash
cd fitness-server
mvn -Dtest=AuthServiceTest,MembershipServiceTest,ExerciseCommandServiceTest,ExerciseFavoriteServiceTest,ExerciseQueryServiceTest,TemplateCommandServiceTest,WeeklyReviewServiceTest,SharePreviewServiceTest test
cd ../fitness-front
npm run test:run -- src/utils/__tests__/membership-entitlements.test.ts src/utils/__tests__/membership-page-contract.test.ts
npm run typecheck
```

Expected: all commands complete with zero failures.

- [ ] **Step 5: Commit docs and final integration changes with narrow pathspecs**

Create separate backend and frontend commits. Root `PRODUCT.md` is outside both Git repositories and must be updated but not accidentally copied into a child repository commit.
