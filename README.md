# FitForge Uni-app

FitForge 现已从原 React 原型重构为 `uni-app + Vue 3 + TypeScript` 多端项目，目标运行端包括：

- H5
- 微信小程序
- iOS App
- Android App

## Project Structure

- `src/`
  uni-app 实际源码目录
- `src/pages/`
  真实页面路由
- `src/components/`
  公共 UI 组件
- `src/stores/`
  Pinia 状态
- `src/mock/`
  本地 mock 数据
- `src-react-reference/`
  迁移前 React 参考实现，只用于比对 UI/交互

## Core Routes

Tab 页面：

- `pages/home/index`
- `pages/exercises/index`
- `pages/profile/index`

二级页面：

- `pages/home/select-template`
- `pages/home/workout-active`
- `pages/home/workout-calendar`
- `pages/home/volume-trend`
- `pages/home/history-detail`
- `pages/exercises/detail`
- `pages/profile/history`
- `pages/profile/template-manager`
- `pages/profile/favorites`
- `pages/profile/settings`
- `pages/profile/about`

## Install

```bash
npm install
```

## Run

H5:

```bash
npm run dev:h5
```

微信小程序：

```bash
npm run dev:mp-weixin
```

## Build

H5:

```bash
npm run build:h5
```

微信小程序：

```bash
npm run build:mp-weixin
```

App:

```bash
npm run build:app-plus
```

## Verification Status

当前已验证：

- `npm run build:h5`
- `npm run build:mp-weixin`
- `npm run build:app-plus`

均可完成构建。

## Compatibility Notes

- 为了保证三端稳定，趋势页暂时使用自绘柱状/进度布局，而不是继续沿用 React 版 `recharts`
- 图标未继续依赖 React 图标库，改成了更轻量的文本/符号表达，后续如需更高视觉一致性，可再替换为统一图标资源
- 当前数据仍为本地 mock，尚未接入真实后端
- 旧的 React 文件仍保留在仓库中，但不再作为 uni-app 构建入口
