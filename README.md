# FitForge Frontend

FitForge frontend is a uni-app application built with Vue 3 and TypeScript. It targets H5, WeChat Mini Program, and App builds from the same source tree.

## Tech Stack

- uni-app + Vue 3
- TypeScript
- Vite + `@dcloudio/vite-plugin-uni`
- Pinia
- SCSS

## Project Structure

- `src/main.ts`: application entry and Pinia setup.
- `src/App.vue`: app lifecycle, theme initialization, update checks, and silent token validation.
- `src/pages.json`: page and tab routing.
- `src/api/http.ts`: shared API request wrapper.
- `src/api/*.ts`: domain API clients and request/response types.
- `src/pages/`: real page implementations used by the current build.
- `src/components/`: shared UI components.
- `src/stores/`: Pinia stores.
- `src/types/`: shared TypeScript types.
- `scripts/`: build helper scripts.

The repository also contains some top-level legacy or migration-era folders. Current development should prefer the `src/` tree unless a task explicitly targets those older files.

## Prerequisites

- Node.js compatible with the current Vite and uni-app toolchain.
- npm.
- Backend API service, normally served by `fitness-server`.

## Environment

Create local environment files from the examples already present in this repository. Common variables include:

- `VITE_API_BASE_URL`
- `VITE_STATIC_ASSET_BASE_URL`
- `VITE_WECHAT_REAL_LOGIN`
- `VITE_WECHAT_LOGIN_TIMEOUT_MS`
- `VITE_API_TIMEOUT_MS`
- `VITE_API_DEBUG`

Do not commit local secrets or production-only values.

## Install

```bash
npm install
```

## Development

Run the H5 app:

```bash
npm run dev:h5
```

Run the WeChat Mini Program build in development mode:

```bash
npm run dev:mp-weixin
```

## Build

Build H5:

```bash
npm run build:h5
```

Build WeChat Mini Program:

```bash
npm run build:mp-weixin
```

Build WeChat Mini Program for production mode:

```bash
npm run build:mp-weixin:prod
```

Build App:

```bash
npm run build:app-plus
```

## Verification

Run the frontend verification pipeline:

```bash
npm run verify
```

This currently runs formatting checks, TypeScript checks, and the WeChat Mini Program build.

## Backend Contract

The frontend expects backend responses in the shape:

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

Authentication uses the local token key `LIFTLOG_TOKEN` and sends the token in the `satoken` request header. API clients should go through `src/api/http.ts` so authentication failures and business errors are handled consistently.
