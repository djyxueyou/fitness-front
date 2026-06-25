# FitForge Stage C/D Merged Implementation Plan

> For agentic workers: implement task by task, keep core decisions in the backend, and avoid production-era migration or old-data compatibility work unless a current test requires it.

## Goal

把阶段 C 的留存能力和阶段 D 的会员/分享能力合并推进：

- C1 周复盘：给用户一个可执行结论，而不是只展示图表。
- C2 逾期恢复：后端判断当前计划状态，前端只展示建议和执行入口。
- C3 训练草稿可靠性增强：保留 48 小时草稿、保存失败可重试，不做完整离线同步。
- D1 高级洞察：保留基础统计免费，高级趋势结论走会员权益。
- D2 会员价值说明：解释“为什么需要 Pro”，不影响基础训练闭环。
- D3 轻量分享：先做本次训练/周复盘/计划预览卡片，不做复杂公开社交链路。

## Architecture Rules

- 后端负责状态判断、结论文案 key、行动建议、权限边界和数据聚合。
- 前端负责展示、交互确认、空状态和页面跳转，不复制核心算法。
- 项目未上线，不处理历史迁移和复杂旧数据兼容；表结构变更直接改 schema 和必要 SQL 说明。
- 基础训练、系统计划、最近记录、本周基础统计免费。
- 高级洞察、深度趋势解释、会员价值解释走统一会员权益。
- 分享默认保护隐私；MVP 优先生成卡片/复制摘要，不引入公开动态流。

## Success Criteria

- 周复盘接口能覆盖无训练、自由训练、计划部分完成、计划完成、计划逾期状态。
- 首页和周复盘页面只消费后端 action，不在前端自行推断计划状态。
- 草稿保存失败后不丢失训练数据，用户能手动重试或稍后处理。
- 高级洞察接口复用现有分析数据，会员检查集中在后端服务/控制器。
- 分享入口轻量可用，默认不暴露精确重量、身体指标、备注和限制信息。
- `mvn` 针对性测试、前端 typecheck 和 H5 构建通过。

## Task 1: Weekly Review Backend Contract

- [ ] Create weekly review DTOs: summary, day distribution, highlights, attention items, next action.
- [ ] Implement `WeeklyReviewService` using training records and active plan summary.
- [ ] Add `GET /api/trainings/weekly-review?weekStart=YYYY-MM-DD`.
- [ ] Keep this endpoint free; do not call advanced analytics membership checks.
- [ ] Write service tests first for:
  - no records and no active plan
  - free-training-only week
  - active plan completed this week
  - active plan partially completed
  - active plan with overdue count
- [ ] Verify:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=WeeklyReviewServiceTest" test
```

## Task 2: Weekly Review Frontend

- [ ] Add `src/api/weekly-review.ts`.
- [ ] Add `src/pages/home/weekly-review.vue`.
- [ ] Replace homepage weekly rhythm copy with backend summary and one next action.
- [ ] Keep training calendar as a separate link.
- [ ] Use current light iOS-style design tokens; Product Design can refine layout if needed.
- [ ] Verify:

```powershell
npm run typecheck
npm run build:h5
```

## Task 3: Overdue Recovery MVP

- [ ] Backend returns overdue action metadata from weekly review and active plan summary.
- [ ] Frontend displays an overdue recovery sheet with:
  - start overdue training today
  - skip this plan day
  - view training calendar
- [ ] Do not implement plan-day rescheduling yet; defer it until users actually need date-level edits.
- [ ] Verify skipped day affects plan summary through existing plan-day state logic.

## Task 4: Draft Reliability Enhancement

- [ ] Change draft TTL from 6 hours to 48 hours.
- [ ] Preserve expired drafts as explicit state instead of silently deleting them.
- [ ] Save the last submit payload and client request id before server submission.
- [ ] On save failure, keep the draft and expose manual retry.
- [ ] Do not add automatic background sync, multiple pending records, or conflict merge UI.
- [ ] Verify old active draft, expired draft, save failure, retry success and duplicate-save protection.

## Task 5: Advanced Insight Backend

- [ ] Add an advanced summary service that reuses dashboard, weekly volume, muscle distribution, PR and exercise trend data.
- [ ] Return data-readiness state when records are insufficient.
- [ ] Detect plateau only when the backend has enough valid records.
- [ ] Keep plan edits manual; insight never auto-modifies a plan.
- [ ] Add `GET /api/trainings/analytics/advanced-summary` behind membership check.
- [ ] Verify:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=TrainingInsightServiceTest,TrainingAnalyticsServiceTest" test
```

## Task 6: Analysis and Membership UI

- [ ] Keep basic weekly stats and recent trend visible to free users.
- [ ] Put conclusion and next action before charts.
- [ ] Show data-readiness messages instead of empty locked charts.
- [ ] Add a small Pro value explainer before membership navigation.
- [ ] Do not interrupt training save or basic plan use with paywalls.

## Task 7: Lightweight Sharing

- [ ] Add share card sheet for workout summary and weekly review.
- [ ] Add plan preview share card using existing plan data.
- [ ] Default hidden fields: exact weights, body metrics, notes, limitations and private profile text.
- [ ] Generate a card preview first; platform share/copy is a secondary action.
- [ ] Keep backend share token work optional for later public links.

## Task 8: Final Verification

- [ ] Run targeted backend tests for new services.
- [ ] Run frontend typecheck and H5 build.
- [ ] Manually verify homepage, weekly review, overdue sheet, draft recovery, analysis paywall and share card preview.
- [ ] Confirm no complete offline sync, public social feed, or old-data migration code was introduced.
