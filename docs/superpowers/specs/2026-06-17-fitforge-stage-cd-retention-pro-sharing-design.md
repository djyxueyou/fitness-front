# FitForge 阶段 C/D 合并设计：留存可靠性、高级价值与轻量分享

## 1. 文档目的

本文定义 FitForge 阶段 C 和阶段 D 的合并产品与技术设计。阶段 C 关注用户持续训练、错过训练后的恢复、训练草稿可靠性；阶段 D 关注高级分析、会员价值表达和轻量分享。

当前项目尚未投入生产使用，因此本阶段不为历史线上数据、旧接口兼容或复杂迁移做额外设计。允许通过清晰的新表、新接口和新前端状态替换尚未稳定的过渡实现，但仍要求代码边界清楚、测试覆盖关键业务规则、核心逻辑由后端处理。

## 2. 设计原则

1. **后端负责业务结论**
   - 周复盘结论、错过训练状态、补练/改期/跳过规则、高级分析洞察、会员权益、分享 token 权限都由后端计算或校验。
   - 前端只负责展示、用户选择、调用接口和轻量本地状态。

2. **基础训练闭环免费**
   - 训练保存、基础周统计、最近记录、基础训练总结、基础周复盘和基础分享卡不作为会员功能。
   - Pro 价值来自更深的解释、趋势、洞察、模板和自动化能力，而不是阻断基础训练。

3. **分享先轻量，模型可扩展**
   - 第一版只做训练总结卡、周复盘卡、计划预览三类分享。
   - 不做社交 Feed、复杂权限后台、多模板市场、长期公开主页、教练协作或完整训练详情公开链接。
   - 后端 share token 模型预留后续扩展字段，但第一版只启用必要字段。

4. **可靠性优先于完整离线同步**
   - 本阶段做“训练草稿可靠性增强”，不做完整离线训练同步。
   - 前端保存本地草稿；后端负责幂等保存、保存结果确认和重复提交保护。

5. **页面体验保持年轻、干净、偏 iOS**
   - 新页面和弹层沿用当前亮色主题、卡片、轻阴影、暖橙主色。
   - 周复盘、会员页和分享卡 UI 可以使用 Product Design 辅助设计，但最终实现必须复用现有主题变量和组件风格。

## 3. 范围

### 3.1 包含

阶段 C：
- 首页“本周节奏”升级为后端驱动的周结论和下一步行动。
- 周复盘页。
- 错过训练恢复：今天补练、改期、跳过。
- 日历、历史记录、训练总结与周复盘的语义对齐。
- 训练草稿 48 小时可靠保存。
- 训练保存失败后的草稿保留和手动重试。

阶段 D：
- 高级分析摘要。
- 会员权益集中定义和会员页价值重构。
- 轻量分享：训练总结卡、周复盘卡、计划预览。
- 分享 token 后端模型。
- 分享和会员相关基础埋点。

### 3.2 不包含

- 完整离线同步队列。
- 多设备草稿冲突合并。
- 公开动态社区。
- 教练版、创作者计划市场。
- HealthKit / Health Connect。
- 分享模板市场。
- 完整训练详情公开链接。
- 支付流程重构。
- 复杂数据迁移或兼容历史线上数据。

## 4. 阶段拆分

虽然 C/D 合并设计，但开发按依赖顺序推进：

1. **C1：周复盘后端聚合**
2. **C2：错过训练恢复**
3. **C3：训练草稿可靠性增强**
4. **D1：高级分析摘要**
5. **D2：会员权益与会员页价值重构**
6. **D3：轻量分享**

每个子阶段都必须可以独立验证，不允许一次性堆完所有前后端代码后再整体调试。

## 5. C1 周复盘

### 5.1 产品目标

用户打开首页或训练完成后，可以快速知道：
- 本周练得怎么样。
- 有没有按计划执行。
- 哪些地方值得注意。
- 下一步应该做什么。

周复盘不是纯展示数据，而是服务“继续训练”的决策入口。

### 5.2 后端职责

新增周复盘聚合服务，基于用户、周起止日期和当前计划状态返回：

```ts
interface WeeklyReview {
  weekStart: string
  weekEnd: string
  headline: string
  recommendation: string
  sessionsCompleted: number
  sessionsPlanned: number
  completionRate?: number
  totalVolumeKg: number
  totalDurationSeconds: number
  prCount: number
  distribution: WeeklyDaySummary[]
  highlights: WeeklyReviewItem[]
  attentionItems: WeeklyReviewItem[]
  nextAction?: WeeklyNextAction
}

interface WeeklyDaySummary {
  date: string
  weekday: number
  planned: boolean
  completed: boolean
  overdue: boolean
  skipped: boolean
}

interface WeeklyReviewItem {
  type: string
  title: string
  description: string
  targetType?: string
  targetId?: number
}

interface WeeklyNextAction {
  type: 'START_PLAN_DAY' | 'RECOVER_OVERDUE' | 'START_FREE_WORKOUT' | 'VIEW_PLAN' | 'REST'
  title: string
  description: string
  targetId?: number
}
```

后端规则：
- 有计划时，以计划完成率为主结论。
- 无计划但有训练记录时，总结自由训练表现。
- 无训练记录时，给出开始训练入口。
- 有逾期计划日时，`nextAction.type` 优先为 `RECOVER_OVERDUE`。
- PR、容量、时长只作为支撑数据，不让前端拼接结论。

### 5.3 前端职责

- 首页“本周节奏”展示 `headline`、三个核心指标和一个下一步行动。
- 周复盘页展示完整 `WeeklyReview`。
- 前端不自行推导完成率等级、不判断逾期优先级。
- 接口失败时保留已有基础周统计展示，并提供重试。

## 6. C2 错过训练恢复

### 6.1 产品目标

用户错过计划训练后，不应该感觉计划废了。系统给出三个清晰选择：
- 今天补练。
- 移动到其他日期。
- 跳过并继续。

### 6.2 后端职责

后端负责判断用户当前 active plan 中的逾期训练日，并提供可执行恢复操作。

建议接口：

```text
GET  /api/user/plans/active/overdue-days
POST /api/user/plans/active/days/{dayId}/make-up-today
POST /api/user/plans/active/days/{dayId}/reschedule
POST /api/user/plans/active/days/{dayId}/skip
```

`reschedule` 请求：

```ts
interface ReschedulePlanDayRequest {
  targetDate: string
  confirmConflict?: boolean
}
```

后端规则：
- 只作用于用户启用后的计划实例，不修改系统计划模板。
- 改期目标日期必须在当前计划周期允许范围内。
- 如果目标日期已有计划日，后端返回冲突信息；前端二次确认后带 `confirmConflict=true`。
- 跳过只跳过当前逾期日，不删除后续安排。
- 今天补练后，该训练日成为首页主任务。

### 6.3 前端职责

- 首页、计划页、周复盘页出现逾期状态时展示恢复入口。
- 恢复入口使用底部面板，不用系统弹窗。
- 日期选择只做展示和提交，冲突判断以后端返回为准。
- 完成恢复操作后刷新首页、计划摘要和周复盘。

## 7. C3 训练草稿可靠性增强

### 7.1 产品目标

用户训练中退出、断网或保存失败时，不丢当前训练。用户可以继续训练或手动重试保存。

### 7.2 前端职责

前端负责本地草稿：

```ts
interface ReliableWorkoutDraft {
  clientRequestId: string
  payload?: SaveTrainingRequest
  savedAt: string
  expiresAt: string
  status: 'ACTIVE' | 'EXPIRED' | 'SAVE_FAILED' | 'SUBMITTING'
  errorCategory?: 'NETWORK' | 'SERVER' | 'UNAUTHORIZED' | 'UNKNOWN'
}
```

规则：
- 草稿有效期调整为 48 小时。
- 过期草稿不静默删除，进入 `EXPIRED` 状态。
- 同一设备同一时间只保留一份训练草稿。
- 开始新训练前，如果存在可恢复草稿，必须恢复或丢弃。
- 保存失败时保留草稿和原始 `clientRequestId`。
- 用户手动点击“重新提交”时使用原 `clientRequestId`。

### 7.3 后端职责

后端负责训练保存幂等：
- `clientRequestId` 对同一用户唯一。
- 重复提交同一个 `clientRequestId` 时返回原保存结果或明确已保存状态。
- 后端不依赖前端判断是否重复训练。
- 保存成功后前端才清除本地草稿。

### 7.4 不做的事

- 不做自动后台重试队列。
- 不做多个离线训练草稿列表。
- 不做多设备草稿同步。
- 不做冲突合并。

## 8. D1 高级分析摘要

### 8.1 产品目标

高级分析要回答“我哪里进步了、哪里需要注意、下阶段怎么练”，而不是堆图表。

### 8.2 后端职责

新增高级分析摘要：

```ts
interface AdvancedAnalyticsSummary {
  range: 'MONTH' | 'NINETY_DAYS' | 'YEAR'
  headline: string
  highlights: AnalyticsInsight[]
  attentionItems: AnalyticsInsight[]
  dataReadiness: AnalyticsDataReadiness[]
  proLocked: boolean
}

interface AnalyticsInsight {
  type: string
  title: string
  description: string
  metricValue?: number
  metricUnit?: string
  actionType?: string
  actionTargetId?: number
}

interface AnalyticsDataReadiness {
  capability: string
  ready: boolean
  currentCount: number
  requiredCount: number
  message: string
}
```

后端规则：
- 平台期判断至少需要同一动作 4 次有效记录。
- 最新 3 次无明显重量、次数或容量提升时，只提示“可能进入平台期”，不自动改计划。
- 肌群偏差基于计划目标和实际完成记录。
- 数据不足时返回明确生成条件，不返回空图表。

### 8.3 前端职责

- 基础统计继续免费展示。
- 高级洞察先展示“数据准备度”和可回答的问题。
- 用户点击高级详情时，先展示 Pro 价值说明，再进入会员页。
- 前端不自行判断平台期和训练偏差。

## 9. D2 会员权益与会员页

### 9.1 产品目标

会员页不卖抽象功能列表，而是根据用户当前训练数据说明“升级后能得到什么具体帮助”。

### 9.2 后端职责

集中定义权益：

```ts
type EntitlementCode =
  | 'ADVANCED_ANALYTICS'
  | 'PROGRESSION_HISTORY'
  | 'UNLIMITED_CUSTOM_PLANS'
  | 'UNLIMITED_CUSTOM_TEMPLATES'
  | 'ADVANCED_SHARE_TEMPLATES'
  | 'AUTOMATED_EXPORT'
```

会员状态接口返回：

```ts
interface MembershipStatus {
  active: boolean
  trialAvailable: boolean
  expiresAt?: string
  entitlements: Record<EntitlementCode, boolean>
}
```

规则：
- 基础训练保存不检查会员。
- 系统计划、系统模板、基础周复盘和基础分享卡不检查会员。
- 自定义计划/模板数量限制、高级分析、高级分享模板由后端权益判断。
- 后端失败时，基础功能按免费能力运行。

### 9.3 前端职责

- 会员页接收入口上下文，例如 `entryPoint=advanced_analytics`。
- 根据后端会员状态和高级分析准备度展示一个真实价值摘要。
- 不伪造用户未产生的数据。
- 不改现有支付流程，只优化会员页结构和触达说明。

## 10. D3 轻量分享

### 10.1 产品目标

第一版分享服务两类场景：
- 用户想生成图片卡片，发朋友圈、微信群、小红书或保存截图。
- 用户想把计划预览分享给朋友，对方可以只读查看，后续再扩展复制计划。

### 10.2 第一版分享类型

1. **训练总结分享卡**
   - 来源：训练完成页、训练详情页。
   - 内容：训练名称、日期、时长、动作数、组数、PR 数。
   - 默认隐藏：具体重量、身体指标、备注、失败组细节。

2. **周复盘分享卡**
   - 来源：周复盘页。
   - 内容：本周训练次数、总时长、完成率、一句亮点。
   - 默认隐藏：具体动作重量、身体指标、备注。

3. **计划预览分享**
   - 来源：计划详情页。
   - 内容：计划名称、周期、训练日、动作数量和训练日结构。
   - 接收方只读预览。
   - 后续可扩展“复制为我的计划”。

### 10.3 后端职责

新增轻量 share token：

```ts
interface ShareToken {
  id: number
  token: string
  ownerUserId: number
  resourceType: 'WORKOUT_SUMMARY' | 'WEEKLY_REVIEW' | 'PLAN_PREVIEW'
  resourceId: number
  visibility: 'CARD' | 'PREVIEW'
  privacyLevel: 'PUBLIC_SAFE'
  expiresAt: string
  revokedAt?: string
  createdAt: string
}
```

第一版只启用：
- `token`
- `ownerUserId`
- `resourceType`
- `resourceId`
- `visibility`
- `privacyLevel`
- `expiresAt`
- `revokedAt`

后端规则：
- 分享 token 只读。
- 默认 7 天过期。
- owner 可以撤销分享。
- `PUBLIC_SAFE` 不返回具体重量、身体指标、备注、伤病限制、内部训练反馈。
- 计划预览不暴露创建者历史表现。

### 10.4 前端职责

每个页面只放一个轻量入口：
- 训练完成页：`生成分享卡`
- 周复盘页：`分享本周复盘`
- 计划详情页：`分享计划`

点击后展示底部面板：
- 分享预览。
- 保存图片。
- 分享给微信好友。
- 隐私说明：默认隐藏具体重量、身体指标和备注。

第一版不做：
- 多套模板。
- 自定义字段开关。
- 长期公开主页。
- 分享权限管理后台。
- 教练查看完整详情。
- 社交 Feed。
- 水印移除。

后续扩展方向：
- 更多卡片模板。
- 自定义显示字段。
- Pro 高级周报卡。
- 计划复制。
- 更长有效期。
- 私密详情链接。

## 11. 页面与信息架构

### 11.1 首页

首页继续保持单一主行动：
- 有草稿：继续训练。
- 有逾期训练：安排错过训练。
- 今日有计划：开始今日计划。
- 无计划：选择训练计划或自由练。

“本周节奏”改为后端 `WeeklyReview` 的摘要，不再只展示静态统计。

### 11.2 周复盘页

结构：
1. 周期选择。
2. 一句话结论。
3. 下一步行动。
4. 核心指标。
5. 周内分布。
6. 亮点。
7. 需要关注。
8. 分享本周复盘。

### 11.3 计划页

新增逾期恢复入口：
- 当前计划卡展示逾期数量。
- 计划详情页展示每个计划日状态。
- 恢复操作由后端返回结果驱动。

### 11.4 训练页与训练完成页

训练页：
- 保存失败不结束训练。
- 提供保存失败状态和手动重试。

训练完成页：
- 展示保存成功后的总结。
- 提供基础分享卡入口。
- 展示本周进度和下一步行动。

### 11.5 分析页

基础分析免费。
高级分析展示：
- 数据准备度。
- 可获得的洞察。
- Pro 说明入口。

### 11.6 会员页

结构：
1. 用户当前可解锁的真实价值摘要。
2. 三个核心 Pro 结果。
3. 免费与 Pro 对比。
4. 套餐与支付。
5. 试用、续费和到期说明。

### 11.7 分享预览页

第一版只需要计划预览落地为可访问页面。训练总结卡和周复盘卡优先生成图片卡，不一定需要公开详情页。

## 12. 数据与接口边界

### 12.1 后端新增能力

建议模块：
- `training.review`：周复盘。
- `plan.recovery`：逾期训练恢复。
- `training.insight`：高级分析。
- `membership.entitlement`：权益判断。
- `share`：分享 token。

模块可以在现有单体项目内实现，不拆微服务。

### 12.2 前端新增能力

建议新增：
- `src/api/weekly-review.ts`
- `src/api/insights.ts`
- `src/api/share.ts`
- `src/components/overdue-workout-sheet/`
- `src/components/pro-value-explainer/`
- `src/components/share-card-sheet/`
- `src/pages/home/weekly-review.vue`
- `src/pages/plan/shared-preview.vue`

前端 Store 只保存 UI 状态、当前请求结果和本地草稿，不保存业务规则。

## 13. 埋点

事件必须结构化，不包含用户备注、身体指标、具体重量明细等敏感内容。

阶段 C：
- `weekly_review_viewed`
- `weekly_next_action_clicked`
- `overdue_workout_resolution_opened`
- `overdue_workout_resolved`
- `workout_draft_restored`
- `workout_draft_discarded`
- `training_save_failed`
- `training_save_retry_clicked`
- `training_save_retry_succeeded`

阶段 D：
- `advanced_analytics_previewed`
- `advanced_analytics_opened`
- `pro_value_explainer_viewed`
- `paywall_viewed`
- `trial_started`
- `subscription_paid`
- `share_card_created`
- `share_card_shared`
- `shared_plan_opened`

埋点失败不得影响业务流程。

## 14. 错误与空状态

### 14.1 周复盘接口失败

前端显示基础统计和重试按钮；不伪造结论。

### 14.2 无训练记录

周复盘返回开始训练建议；前端展示空状态和开始入口。

### 14.3 无计划

周复盘只总结实际训练，不显示计划完成率。

### 14.4 改期冲突

后端返回冲突说明；前端展示二次确认。

### 14.5 保存失败

前端保留草稿和当前训练状态；后端通过 `clientRequestId` 保证重试幂等。

### 14.6 高级分析数据不足

后端返回数据准备度；前端展示还差几次训练，不显示空图表。

### 14.7 分享过期或撤销

分享预览页显示不可用状态，不泄露资源是否存在的敏感细节。

## 15. 测试要求

后端必须覆盖：
- 周复盘五类状态：有计划完成、有计划部分完成、低完成率、无计划有训练、无训练。
- 逾期恢复：补练、改期、冲突确认、跳过。
- 草稿保存相关：`clientRequestId` 幂等。
- 高级分析：数据不足、有提升、疑似平台期。
- 权益判断：免费、试用、会员、过期。
- 分享 token：正常、过期、撤销、非 owner 操作、隐私字段过滤。

前端必须覆盖：
- 类型检查。
- H5 构建。
- 小程序构建。
- 首页周复盘摘要展示。
- 逾期恢复面板交互。
- 保存失败状态和重试入口。
- 分享卡底部面板。
- 会员价值说明入口。

## 16. 验收标准

阶段 C 验收：
- 首页能展示后端返回的本周结论和下一步行动。
- 用户错过训练后可以补练、改期或跳过。
- 训练保存失败后草稿不丢失，可以手动重试。
- 草稿 48 小时内可恢复，过期后不静默删除。

阶段 D 验收：
- 基础分析和基础分享不阻断免费训练闭环。
- 高级分析由后端返回结论和数据准备度。
- 会员页展示真实、与当前用户状态相关的价值说明。
- 分享第一版只包含训练总结卡、周复盘卡、计划预览。
- 分享默认隐藏敏感训练和身体数据。
- 分享模型支持后续扩展，但第一版 UI 不暴露复杂配置。

## 17. 明确决策

1. 周复盘基础版免费，高级洞察可作为 Pro。
2. 分享基础版免费，后续高级模板和自定义字段可作为 Pro。
3. 不做完整离线同步，只做本地草稿可靠性和手动重试。
4. 不做公开社区和 Feed。
5. 不做复杂数据迁移，因为当前项目未投入生产。
6. 核心判断全部后端负责，前端不得复制业务规则。

## 18. 方案取舍

### 18.1 周复盘

可选方案：
- 前端基于已有统计自行拼接结论。
- 后端提供原始统计，前端按规则生成结论。
- 后端直接返回结论、注意项和下一步行动。

选择第三种。原因是周复盘属于业务判断，不只是展示数据。后端统一计算可以避免 H5、小程序、App 三端结论不一致，也便于后续把高级洞察和会员权益接入同一套判断链路。

### 18.2 草稿可靠性

可选方案：
- 只延长本地草稿有效期。
- 做完整离线同步队列。
- 本地草稿增强 + 后端保存幂等。

选择第三种。完整离线同步会引入多草稿、冲突合并、后台重试和跨设备状态，当前阶段收益不够；只延长有效期又无法解决保存失败后的重复提交和结果确认。当前设计保留简单性，同时解决最核心的“不丢训练”和“可重试保存”。

### 18.3 分享

可选方案：
- 只做前端截图。
- 做完整分享平台和公开详情页。
- 做轻量分享卡 + 计划预览 token。

选择第三种。纯截图无法支撑计划预览和后续复制计划；完整分享平台会过早引入社区、权限和内容治理。轻量 token 可以支撑第一版需求，也为后续扩展私密详情链接、更多模板和 Pro 分享能力保留接口。

### 18.4 会员价值

可选方案：
- 保持现有会员弹窗和功能锁。
- 大量功能直接转 Pro。
- 基础闭环免费，高级解释和效率能力 Pro。

选择第三种。FitForge 现阶段最重要的是让用户形成训练习惯。训练保存、基础复盘和基础分享必须服务留存和增长；Pro 应该建立在真实训练数据带来的高级洞察、效率和表达能力上。
