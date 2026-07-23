# AGENTS.md

## 适用范围

本文件只描述 `fitness-front/` 前端子项目。涉及后端接口、数据库或联调时，同时阅读根目录 `../AGENTS.md`。

## 技术栈

- uni-app
- Vue 3
- TypeScript
- Vite + `@dcloudio/vite-plugin-uni`
- Pinia
- SCSS
- Prettier
- ESLint 配置存在，但没有确认的 npm lint 脚本

## 入口和关键文件

- `src/main.ts`：创建 uni-app SSR app，并安装 Pinia。
- `src/App.vue`：应用启动生命周期、主题初始化、小程序更新检查、token 静默校验。
- `src/pages.json`：真实页面路由配置。
- `src/manifest.json`：应用和多端平台配置。
- `vite.config.js`：Vite/uni 插件配置，`@` 指向 `src`。
- `src/api/http.ts`：统一请求封装。
- `src/api/*.ts`：按业务域拆分的 API 封装和类型。
- `src/stores/*.ts`：Pinia 状态。
- `src/components/**`：公共组件。
- `src/styles/**`、`src/uni.scss`：全局样式。

目录中还存在顶层 `pages/`、`components/`、`stores/`、`mock/`、`types/`、`utils/`。当前 tsconfig 和 Vite alias 都指向 `src/`，因此默认优先修改 `src/` 下文件；除非任务明确要求处理顶层镜像/旧结构。

## 命令

安装：

```bash
npm install
```

H5 开发：

```bash
npm run dev:h5
```

微信小程序开发：

```bash
npm run dev:mp-weixin
```

H5 构建：

```bash
npm run build:h5
```

微信小程序构建：

```bash
npm run build:mp-weixin
```

微信小程序生产构建：

```bash
npm run build:mp-weixin:prod
```

App 构建：

```bash
npm run build:app-plus
```

格式化：

```bash
npm run format
```

格式检查：

```bash
npm run format:check
```

类型检查：

```bash
npm run typecheck
```

完整前端校验：

```bash
npm run verify
```

单元测试命令：未确认。`package.json` 中没有发现 test 脚本。

lint 命令：未确认。存在 `eslint.config.js`，但 `package.json` 中没有 `lint` 脚本。

## 环境变量

已发现的环境文件：

- `.env.example`
- `.env.mp-weixin`
- `.env.mp-weixin-prod`

已发现变量：

- `VITE_API_BASE_URL`
- `VITE_STATIC_ASSET_BASE_URL`
- `VITE_WECHAT_REAL_LOGIN`
- `VITE_WECHAT_LOGIN_TIMEOUT_MS`
- `VITE_API_TIMEOUT_MS`
- `VITE_API_DEBUG`

`src/api/http.ts` 在缺少 `VITE_API_BASE_URL` 时回退到 `http://127.0.0.1:8080`；但 `.env.example` 使用 `http://localhost:8081`，与后端 dev 默认端口一致。

## API 约定

- API 封装放在 `src/api/<domain>.ts`。
- 普通请求使用 `src/api/http.ts` 的 `request<T>()`。
- 请求/响应 TypeScript interface 尽量和对应 API 函数放在同一文件。
- 后端响应预期为 `{ code, message, data }`。
- token 存储 key 为 `LIFTLOG_TOKEN`。
- token 请求头为 `satoken`。
- `src/api/http.ts` 只在 HTTP 401 或后端业务码 `40100` 时清理登录态；HTTP 403（包括会员权限码 `40311`）保留登录态并由业务页面处理。

修改 API 调用前，先核对后端 controller、DTO、鉴权要求和响应结构。

## 代码风格

- TypeScript strict mode 已开启。
- 源码导入使用 `@/`。
- Prettier：2 空格、无分号、单引号、无 trailing comma、`printWidth: 100`。
- 当前 Vue SFC 主要使用 `<script setup lang="ts">`。
- 不要绕过 `src/api/http.ts` 直接写普通 JSON 请求。

## 平台注意事项

- `npm run build:mp-weixin` 和 `npm run build:mp-weixin:prod` 构建后会执行 `scripts/sync-mp-weixin-appid.mjs`。
- 该脚本会把 `manifest.json` 中的 `mp-weixin.appid` 同步到 `dist/build/mp-weixin/project.config.json`。
- `project.config.json` 已存在，用于微信开发者工具。
