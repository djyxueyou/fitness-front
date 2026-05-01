# Uni-app Fitness Migration Design

**Date:** 2026-04-21

## Goal

将当前 React + TypeScript + Vite 的健身前端原型，完整迁移为 `uni-app + Vue 3 + TypeScript` 项目，并支持：

- 微信小程序
- iOS App
- Android App

迁移目标是保留当前产品的信息架构、主要页面、核心交互链路和整体视觉风格，同时将现有“单路由 + 页面内状态切换”的原型结构重构为适合多端运行的真实页面路由结构。

## Scope

本次迁移包含：

- 首页、动作库、我的三个主 tab 页面
- 首页相关二级页面：选择模板、训练进行中、训练日历、容量趋势、历史详情
- 动作库相关页面：动作详情
- 我的相关页面：历史记录、模板管理、收藏、设置、关于
- 当前主要视觉风格迁移：深色背景、橙红主色、玻璃态卡片、渐变 CTA、信息卡片层级、标题结构
- 当前主要交互迁移：模板选择、开始训练、训练中进度、动作筛选、收藏、历史浏览、设置切换

本次迁移不包含：

- 接入真实后端
- 用户登录、云同步、服务端数据持久化
- 新增超出原型范围的业务功能
- 严格逐帧级别的动画复刻

## Current State Summary

当前项目是一个 React 原型，特点如下：

- 路由层实际上只有 `/`
- `Index` 页面内部通过 `activeTab` 在首页、动作库、我的三块内容之间切换
- 多个二级页面继续通过页面内部 `view` 状态切换
- 视觉上使用固定 `375x812` 手机壳模拟移动端
- 页面数据主要是组件内硬编码的 mock 数据
- 页面之间没有稳定的数据层，更多是页面内局部状态与简单回调

这种结构适合展示原型，但不适合微信小程序和移动 App 的真实运行方式。

## Chosen Approach

采用方案 A：完整迁移为 `uni-app + Vue 3 + TypeScript + 真实页面路由`。

设计原则：

- 保留原有产品结构和核心使用路径
- 用真实页面路由替换页面内状态切换
- 尽量保持现有 UI 视觉特征
- 对不适合三端的 Web 实现做平台化替换
- 先完成可运行的三端迁移，再考虑后续数据接入和产品化增强

## Architecture

### 1. App Structure

新的应用结构采用 `uni-app` 标准页面组织：

- `pages.json` 负责页面注册与 `tabBar`
- 三个主 tab 页面使用真实 tab 路由
- 所有二级页面使用独立页面文件
- 共享 UI 抽为通用组件
- 页面数据和共享状态通过 `Pinia` 管理

### 2. Navigation Model

导航策略采用真实页面路由：

- 主 tab：`switchTab`
- 二级页面：`navigateTo`
- 返回：`navigateBack`

所有当前依赖组件内 `view` 状态切换的页面，都拆分为真实页面。

### 3. Layout Model

放弃固定 `375x812` 手机壳布局，改为真实全屏响应式布局：

- 页面基于设备宽高和安全区适配
- 顶部内容适配状态栏和导航区
- 底部内容适配 tabBar 和安全区
- 保留现有卡片层级、渐变按钮、信息模块视觉结构

## Page Map

### Tab Pages

- `pages/home/index`
- `pages/exercises/index`
- `pages/profile/index`

### Home Subpages

- `pages/home/select-template`
- `pages/home/workout-active`
- `pages/home/workout-calendar`
- `pages/home/volume-trend`
- `pages/home/history-detail`

### Exercise Subpages

- `pages/exercises/detail`

### Profile Subpages

- `pages/profile/history`
- `pages/profile/template-manager`
- `pages/profile/favorites`
- `pages/profile/settings`
- `pages/profile/about`

## Routing Rules

- tab 页面之间只能使用 `switchTab`
- 非 tab 页面统一使用 `navigateTo`
- 非 tab 页面返回统一使用 `navigateBack`
- 详情页优先通过轻量参数传递上下文，例如 `id`、`date`、`type`
- 页面详情数据通过 store 或本地 mock 查询得到，不直接在路由中传大对象

## Component Strategy

只抽高复用公共 UI，避免一开始过度工程化。

### Shared Components

- `app-header`
  - 统一页面头部
  - 支持标题、副标题、返回按钮、右侧操作区
- `glass-card`
  - 统一玻璃态卡片背景、边框、圆角和阴影
- `primary-button`
  - 统一主 CTA 渐变按钮
- `stat-card`
  - 统一统计卡片
- `section-title`
  - 区块标题和右侧操作
- `exercise-item`
  - 动作列表基础项
- `template-item`
  - 模板列表基础项
- `empty-state`
  - 空状态展示
- `progress-bar`
  - 训练进度或数据占比展示
- `toggle-switch`
  - 设置页开关
- `tag-chip`
  - 标签、胶囊、分类筛选项

### Page-local Structures

以下内容暂不抽为通用组件：

- 训练进行中组表格
- 日历网格
- 趋势图表
- 历史详情训练记录块

原因是它们交互和结构较强依赖页面本身，当前复用收益有限。

## Styling Strategy

### Theme

主题变量统一迁移到 `uni.scss`，包括：

- 背景色
- 前景色
- 主色
- 辅助色
- 边框色
- 阴影色
- 圆角
- 间距基准

### Visual Preservation

重点还原：

- 深色健身主题
- 橙红高能主色
- 玻璃态卡片
- 渐变主按钮
- 标题排版层级
- 信息卡片密度
- 列表项和入口卡片的视觉节奏

### Platform Adjustments

允许做以下平台化调整：

- 移除固定手机壳外框
- 调整状态栏和安全区空白
- 调整按钮点击反馈实现
- 适配小程序输入框和滚动容器行为
- 替换不兼容的图标和图表实现

## State and Data Design

### Data Source

第一阶段保留本地 mock 数据，不接后端。

当前页面里内嵌的静态数组会迁出到统一数据目录，例如：

- `src/mock/exercises.ts`
- `src/mock/templates.ts`
- `src/mock/history.ts`

### Store Design

使用 `Pinia` 维护跨页面共享状态。

建议拆分：

- `stores/workout`
  - 当前训练模板
  - 当前训练项目和组状态
  - 训练计时
- `stores/exercise`
  - 动作列表
  - 收藏状态
  - 筛选辅助
- `stores/template`
  - 模板数据
  - 模板编辑、删除、复制
- `stores/profile`
  - 设置项
  - 单位
  - 通知偏好
  - 主题偏好

### Local Page State

以下状态保留在页面内：

- 搜索词
- 当前分类
- 编辑模式开关
- 弹层显隐
- 组件展示态

## Cross-platform Compatibility

### General Rules

- 不依赖 `window`、`document` 等浏览器对象
- 不保留纯 Web 的固定视口壳布局
- 页面、滚动、输入、弹层均使用 uni-app 兼容方式实现
- 所有关键布局都考虑安全区

### Icons

现有 React 图标体系不能直接复用时，改为：

- `uni-icons`
- 或本地静态 icon 资源

以保证微信小程序和 App 端一致性。

### Charts

当前 `recharts` 不适合作为三端通用方案。

趋势页图表建议迁移为：

- `qiun-data-charts`
- 或 uni 兼容 ECharts 方案

优先选择更稳定、接入成本更低的方案。

### Animation

保留以下关键动效：

- 页面进入动效
- CTA 呼吸感
- 按钮按压反馈
- 进度条过渡
- 列表渐入

不追求所有 Web CSS 动画一比一复刻，而是追求三端观感接近。

## Key Interaction Mapping

### Home Flow

- 首页点击“开始训练” -> 进入选择模板页
- 选择模板页点击自由训练或模板训练 -> 进入训练进行中页
- 训练进行中点击完成 -> 完成弹层 -> 保存并返回
- 首页点击训练日历入口 -> 日历页

### Exercise Flow

- 动作库可搜索、分类筛选、收藏
- 点击动作项 -> 动作详情
- 动作详情支持收藏、查看演示、加入训练

### Profile Flow

- 我的页进入历史、模板管理、收藏、设置、关于
- 历史列表 -> 历史详情
- 历史详情支持保存为模板、编辑态展示

## Error Handling

第一阶段错误处理保持轻量：

- 路由参数缺失时显示兜底空态或默认数据
- 本地 mock 查询不到数据时显示空态提示
- 训练状态不存在时禁止进入依赖页面或回退上一页

不在本阶段引入复杂异常上报体系。

## Testing Strategy

迁移阶段重点验证以下内容：

- tab 页面切换是否正常
- 二级页面路由跳转和返回是否正常
- 关键页面在微信小程序、iOS、Android 布局是否稳定
- 训练中状态切换、收藏、模板管理等核心交互是否正常
- 安全区、滚动区、输入区、弹层是否在三端表现正常

由于当前项目本身是原型性质，第一阶段测试优先以页面行为和视觉核对为主。

## Implementation Boundaries

本次实施过程中，以下内容属于允许的结构性重构：

- 删除 React 中通过 `view` 分支维护的页面内嵌视图结构
- 引入新的页面目录、组件目录、store 和 mock 目录
- 为三端兼容替换部分图标、图表和动画实现

以下内容不应在本轮扩展：

- 擅自新增业务功能
- 接入远端 API
- 引入不必要的复杂抽象
- 为未来假设场景做过度设计

## Success Criteria

迁移完成后，应满足：

- 项目基于 `uni-app + Vue 3 + TypeScript` 组织
- 微信小程序、iOS、Android 三端可运行
- 主页面和二级页面均为真实页面路由
- UI 风格与当前原型高度接近
- 核心交互链路可用
- 数据结构比当前原型更清晰，便于后续继续开发

## Risks

### 1. Current Text Encoding Issues

当前源码中存在明显中文乱码，迁移过程中需要统一修复，否则会直接影响页面文案质量。

### 2. Third-party Replacement Cost

部分 React 生态能力无法直接迁移到 uni-app，需要替换为 uni 兼容方案，尤其是：

- 图表
- 图标
- 部分 CSS/动画表现

### 3. Stateful Flow Complexity

训练进行中等页面涉及连续状态，迁移时如果全部放在页面内部会导致回退和恢复逻辑混乱，因此需要从一开始就放入 store。

## Recommendation

按上述设计实施迁移，先完成：

1. 项目基础框架切换
2. 页面路由搭建
3. 主题和公共组件迁移
4. 关键页面逐步迁移
5. 三端兼容修正

完成这一轮后，再视需要进入第二阶段的数据产品化和后端接入。
