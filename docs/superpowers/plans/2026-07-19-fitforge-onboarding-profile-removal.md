# FitForge Onboarding and Training Profile Removal Implementation Plan

> 执行状态：已于 2026-07-19 落地，画像页面、API、Store、后端字段和数据库结构已删除。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the training-profile/onboarding product path completely and make login lead directly to plan selection without leaving frontend, backend, database, export, event, or documentation remnants.

**Architecture:** Keep account profile, physical metrics, and training execution preferences, but delete goal/experience/onboarding state from the user aggregate. The home page derives its primary action only from draft, login, and active-plan state; plan browsing remains the single no-plan path.

**Tech Stack:** uni-app, Vue 3, TypeScript, Pinia, Vitest, Spring Boot 4, Java 17, MyBatis-Plus, MySQL, Maven

## Global Constraints

- The product is not launched; delete obsolete structures instead of preserving compatibility branches.
- User nickname, avatar, height, units, rest time, progression steps, and body metrics remain supported.
- Plan catalog wording must describe browsing and selection, never profile-based recommendation.
- Product-event funnel work remains out of scope; remove the current local-only event buffer when its final callers are removed.
- Preserve all unrelated dirty-worktree changes and commit only files touched by each task.
- Update product documentation and useful business comments in the same task as the behavior they describe.

---

## File Structure

Backend responsibilities:

- Delete `fitness-server/src/main/java/com/liftlog/modules/user/dto/TrainingProfileResponse.java` and `UpsertTrainingProfileRequest.java`.
- Narrow `UpdateUserProfileRequest.java`, `UserProfileResponse.java`, `User.java`, `UserController.java`, and `UserProfileService.java` to account and physical-profile data.
- Add `fitness-server/src/main/resources/db/migration/20260719_remove_training_profile.sql` and update `schema.sql`.
- Update `UserProfileServiceTest.java` and `SchemaSmokeTest.java`.

Frontend responsibilities:

- Delete `fitness-front/src/pages/onboarding/index.vue`, `src/stores/onboarding.ts`, `src/api/onboarding.ts`, and `src/utils/product-events.ts`.
- Remove onboarding route/navigation and all goal/experience fields from account profile API, store, edit UI, and presentation helpers.
- Rewrite home no-plan state and data export without onboarding data.
- Add focused source/contract tests under `fitness-front/src/utils/__tests__/`.

Documentation responsibilities:

- Update root `PRODUCT.md` and mark conflicting historical onboarding specifications as superseded.

### Task 1: Delete the backend training-profile contract and columns

**Files:**

- Delete: `fitness-server/src/main/java/com/liftlog/modules/user/dto/TrainingProfileResponse.java`
- Delete: `fitness-server/src/main/java/com/liftlog/modules/user/dto/UpsertTrainingProfileRequest.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/user/dto/UpdateUserProfileRequest.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/user/dto/UserProfileResponse.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/user/entity/User.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/user/controller/UserController.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/user/service/UserProfileService.java`
- Create: `fitness-server/src/main/resources/db/migration/20260719_remove_training_profile.sql`
- Modify: `fitness-server/src/main/resources/db/schema.sql`
- Test: `fitness-server/src/test/java/com/liftlog/modules/user/UserProfileServiceTest.java`
- Test: `fitness-server/src/test/java/com/liftlog/schema/SchemaSmokeTest.java`

**Interfaces:**

- Produces `UpdateUserProfileRequest(String nickname, String avatarUrl, BigDecimal heightCm)`.
- Produces `UserProfileResponse` without `trainingGoal` or `experienceLevel`.
- Removes `GET/PUT /api/user/training-profile`.

- [ ] **Step 1: Change backend tests to describe the reduced profile contract**

Replace training-profile assertions and constructor calls with account-only behavior:

```java
@Test
void shouldUpdateAccountProfileWithoutTrainingProfileFields() {
    User user = new User();
    user.setId(1L);
    user.setNickname("Old");
    when(userMapper.selectById(1L)).thenReturn(user);

    userProfileService.updateProfile(1L, new UpdateUserProfileRequest(
        "New Name",
        "https://avatar.test/new.png",
        new BigDecimal("178.5")
    ));

    assertEquals("New Name", user.getNickname());
    assertEquals(new BigDecimal("178.5"), user.getHeightCm());
    verify(userMapper).updateById(user);
}
```

Change `SchemaSmokeTest` to assert absence:

```java
assertFalse(sql.contains("training_sessions_per_week"));
assertFalse(sql.contains("training_duration_minutes"));
assertFalse(sql.contains("training_environment"));
assertFalse(sql.contains("training_limitations"));
assertFalse(sql.contains("onboarding_step"));
assertFalse(sql.contains("onboarding_completed"));
```

Do not assert that `system_workout_blueprint.training_goal` is absent; that field describes plan catalog content, not a user profile.

- [ ] **Step 2: Run the focused tests and confirm they fail against the old contract**

Run:

```bash
cd fitness-server
mvn -Dtest=UserProfileServiceTest,SchemaSmokeTest test
```

Expected: compilation or assertions fail because the request still accepts goal/experience and schema still contains onboarding columns.

- [ ] **Step 3: Remove user-profile fields, endpoints, DTOs, and service methods**

Reduce the update request to:

```java
public record UpdateUserProfileRequest(
    @Size(min = 2, max = 20, message = "昵称长度需为 2-20 个字符") String nickname,
    @Size(max = 512, message = "avatarUrl length must be <= 512") String avatarUrl,
    @DecimalMin(value = "80.0", message = "heightCm must be >= 80")
    @DecimalMax(value = "250.0", message = "heightCm must be <= 250") BigDecimal heightCm
) {}
```

Remove the eight training-profile fields and accessors from `User`, remove the two profile endpoints from `UserController`, and remove `trainingProfile`, `upsertTrainingProfile`, `validateTrainingProfile`, and `toTrainingProfile` from `UserProfileService`. Update profile mapping so it emits only account, body metric, and setting fields.

- [ ] **Step 4: Add the destructive pre-launch migration and align schema**

Create the migration with explicit columns:

```sql
ALTER TABLE user
    DROP COLUMN training_goal,
    DROP COLUMN experience_level,
    DROP COLUMN training_sessions_per_week,
    DROP COLUMN training_duration_minutes,
    DROP COLUMN training_environment,
    DROP COLUMN training_limitations,
    DROP COLUMN onboarding_step,
    DROP COLUMN onboarding_completed;
```

Remove the same columns from the `user` table definition in `schema.sql`. Keep plan/blueprint catalog goal and difficulty fields.

- [ ] **Step 5: Run backend tests**

Run:

```bash
cd fitness-server
mvn -Dtest=UserProfileServiceTest,SchemaSmokeTest test
```

Expected: all selected tests pass with zero failures.

- [ ] **Step 6: Commit only backend profile-removal files**

```bash
cd fitness-server
git add src/main/java/com/liftlog/modules/user src/main/resources/db/schema.sql src/main/resources/db/migration/20260719_remove_training_profile.sql src/test/java/com/liftlog/modules/user/UserProfileServiceTest.java src/test/java/com/liftlog/schema/SchemaSmokeTest.java
git commit -m "refactor: remove training profile backend"
```

### Task 2: Remove frontend profile fields and editing UI

**Files:**

- Modify: `fitness-front/src/api/user.ts`
- Modify: `fitness-front/src/stores/profile.ts`
- Modify: `fitness-front/src/pages/profile/edit.vue`
- Delete: `fitness-front/src/utils/profile-presentation.ts`
- Delete: `fitness-front/src/utils/__tests__/profile-presentation.test.ts`
- Create: `fitness-front/src/utils/__tests__/profile-contract.test.ts`

**Interfaces:**

- Consumes the reduced backend `UserProfileResponse` and `UpdateUserProfileRequest` from Task 1.
- Preserves `saveProfile` and `saveProfilePatch` for nickname, avatar, and height only.

- [ ] **Step 1: Add a failing frontend profile-contract test before implementation**

Create a source-contract test that preserves the existing nickname/height validation tests and checks removal of the obsolete fields:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')

describe('account profile contract', () => {
  it('contains no training goal or experience fields', () => {
    for (const source of [
      read('src/api/user.ts'),
      read('src/stores/profile.ts'),
      read('src/pages/profile/edit.vue')
    ]) {
      expect(source).not.toMatch(/trainingGoal|experienceLevel/)
    }
  })
})
```

Delete tests for goal and experience normalization because those concepts no longer exist in account profile.

- [ ] **Step 2: Run the focused frontend test and confirm the old UI contract fails**

Run:

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/profile-contract.test.ts src/utils/__tests__/profile-editing.test.ts
```

Expected: failure until goal/experience inputs and types are removed.

- [ ] **Step 3: Narrow API and Pinia state**

Use these request fields:

```ts
export interface UpdateUserProfileRequest {
  nickname?: string
  avatarUrl?: string
  heightCm?: number | null
}
```

Remove `trainingGoal` and `experienceLevel` from `UserProfileResponse`, cached profile writes, store refs, refresh/reset logic, `saveProfile`, `saveProfilePatch`, and returned store values.

- [ ] **Step 4: Remove goal and experience rows from profile editing**

Delete option-sheet imports, computed goal/experience labels, save handlers, and the corresponding template rows. Keep nickname, avatar, and height editing behavior unchanged. Delete `profile-presentation.ts` and its obsolete test after all imports are gone.

- [ ] **Step 5: Run tests and typecheck**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/profile-contract.test.ts src/utils/__tests__/profile-editing.test.ts
npm run typecheck
```

Expected: selected test and TypeScript checking pass.

- [ ] **Step 6: Commit only frontend profile-contract files**

```bash
cd fitness-front
git add src/api/user.ts src/stores/profile.ts src/pages/profile/edit.vue src/utils/profile-presentation.ts src/utils/__tests__/profile-presentation.test.ts src/utils/__tests__/profile-contract.test.ts
git commit -m "refactor: remove training profile fields"
```

### Task 3: Delete onboarding, local event buffering, and home branches

**Files:**

- Delete: `fitness-front/src/pages/onboarding/index.vue`
- Delete: `fitness-front/src/stores/onboarding.ts`
- Delete: `fitness-front/src/api/onboarding.ts`
- Delete: `fitness-front/src/utils/product-events.ts`
- Modify: `fitness-front/src/pages.json`
- Modify: `fitness-front/src/utils/navigation.ts`
- Modify: `fitness-front/src/pages/home/index.vue`
- Modify: `fitness-front/src/pages/profile/data-privacy.vue`
- Create: `fitness-front/src/utils/__tests__/onboarding-removal.test.ts`

**Interfaces:**

- Produces home primary-action order: recoverable draft, login, active-plan state, choose-plan.
- Produces data export with `trainings` and `bodyMetrics` only; no training profile.

- [ ] **Step 1: Add a source-level regression test for complete removal**

Create a Vitest test that reads the route, navigation, home, and privacy sources:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')

describe('onboarding removal', () => {
  it('has no onboarding route or home decision branch', () => {
    expect(read('pages.json')).not.toContain('pages/onboarding/index')
    expect(read('src/utils/navigation.ts')).not.toContain('onboarding:')
    expect(read('src/pages/home/index.vue')).not.toMatch(/needsOnboarding|建立训练画像|训练偏好/)
  })

  it('does not export a local training profile or buffer product events', () => {
    expect(read('src/pages/profile/data-privacy.vue')).not.toMatch(/onboardingStore|trainingProfile/)
  })
})
```

- [ ] **Step 2: Run the regression test and verify it fails**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/onboarding-removal.test.ts
```

Expected: assertions fail while the old route and home branches remain.

- [ ] **Step 3: Delete onboarding files and routing**

Delete the page, store, API, and route entry. Remove `routes.onboarding`. Remove all onboarding imports and navigation from home and privacy pages.

- [ ] **Step 4: Rewrite home no-plan behavior**

The no-plan computed values must reduce to:

```ts
if (!isLoggedIn.value) return '登录后保存训练数据'
if (!hasActivePlan.value) return '选择一套训练计划'
```

and the primary tap must use:

```ts
if (!hasActivePlan.value) {
  uni.switchTab({ url: routes.planIndex })
  return
}
```

Keep draft recovery above login and plan checks. Replace user-facing “推荐计划” generated-by-profile language with “训练计划” or “系统计划” where the user is browsing catalog content.

- [ ] **Step 5: Remove local product-event storage and clean data export**

Remove both `trackProductEvent` calls from data privacy, remove training-profile data from exported JSON, change the description to “包含训练记录和身体指标”, and delete `product-events.ts` after its onboarding callers are gone.

- [ ] **Step 6: Run focused and full frontend verification**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/onboarding-removal.test.ts
npm run typecheck
npm run build:mp-weixin
```

Expected: test, typecheck, and WeChat mini-program build pass.

- [ ] **Step 7: Commit the onboarding and home cleanup**

```bash
cd fitness-front
git add src/pages/onboarding src/stores/onboarding.ts src/api/onboarding.ts src/utils/product-events.ts src/pages.json src/utils/navigation.ts src/pages/home/index.vue src/pages/profile/data-privacy.vue src/utils/__tests__/onboarding-removal.test.ts
git commit -m "refactor: remove onboarding flow"
```

### Task 4: Synchronize product documentation and run cross-repository checks

**Files:**

- Modify: `PRODUCT.md`
- Modify: `docs/superpowers/specs/2026-07-04-fitforge-plan-personalization-onboarding-design.md`
- Modify: `fitness-front/docs/superpowers/specs/2026-06-14-fitforge-product-optimization-master-design.md`
- Modify: `fitness-server/README.md`

**Interfaces:**

- Establishes `PRODUCT.md` and the approved 2026-07-19 redesign as current facts.

- [ ] **Step 1: Mark historical specifications as superseded**

Add this notice directly below each historical document title:

```markdown
> 状态：历史方案。训练画像、画像推荐和相关事件设计已由
> `2026-07-19-fitforge-product-scope-membership-level-redesign.md` 替代，不再作为当前实现依据。
```

- [ ] **Step 2: Update current product and API documentation**

In `PRODUCT.md`, replace the core loop with “登录 -> 选择计划 -> 调整并启用 -> 训练记录”. Remove the training-profile module and update home/profile sections. In the backend README, remove `/api/user/training-profile` and document that `/api/user/profile` contains only account, height, metrics summary, and training settings.

- [ ] **Step 3: Run a repository-wide stale-symbol check**

```bash
rg -n "needsOnboarding|training-profile|TrainingProfileResponse|UpsertTrainingProfileRequest|FITFORGE_TRAINING_ONBOARDING|onboarding_completed|onboarding_step" fitness-front/src fitness-server/src/main fitness-server/src/test PRODUCT.md
```

Expected: no matches. Matches inside explicitly marked historical specifications are allowed.

- [ ] **Step 4: Run final subsystem verification**

```bash
cd fitness-server
mvn -Dtest=UserProfileServiceTest,SchemaSmokeTest test
cd ../fitness-front
npm run test:run -- src/utils/__tests__/onboarding-removal.test.ts src/utils/__tests__/profile-contract.test.ts src/utils/__tests__/profile-editing.test.ts
npm run typecheck
```

Expected: all commands exit successfully with zero failed tests.

- [ ] **Step 5: Commit documentation in the repository that owns each file**

Commit the frontend-owned historical notice in the frontend repository and the updated backend README in the backend repository. The root workspace is not a Git repository, so update root `PRODUCT.md` and the root historical specification without attempting to include them in a child-repository commit.
