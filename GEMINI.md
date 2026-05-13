# FitForge Uni-app Project Context

This project is a fitness tracking application built with **uni-app**, **Vue 3**, and **TypeScript**. It is a cross-platform mobile application targeting H5, WeChat Mini Program, and Native Apps (iOS/Android).

## Project Overview

- **Core Framework**: uni-app (Vue 3 Composition API)
- **State Management**: Pinia
- **Styling**: SCSS (Sass), following a dark-themed fitness UI design.
- **Build Tool**: Vite
- **Primary Source Directory**: `src/` (Note: root-level folders like `pages/` or `components/` are redundant and should be ignored in favor of `src/`).

## Architecture & Structure

- `src/pages/`: Contains all application pages organized by feature (home, exercises, profile).
- `src/components/`: Reusable UI components. Uses `easycom` for automatic imports (prefixes: `app-`, `glass-`).
- `src/stores/`: Pinia stores for managing global state (workout, exercise, profile, etc.).
- `src/api/`: Network request layer. Currently uses local mock data but is structured for future backend integration.
- `src/utils/`: Shared utility functions for formatting, navigation, and business logic.
- `src/types/`: Centralized TypeScript interfaces and types.
- `src/static/`: Assets like images and icons.

## Key Development Commands

- **Install Dependencies**: `npm install`
- **Development (H5)**: `npm run dev:h5`
- **Development (WeChat)**: `npm run dev:mp-weixin`
- **Build (H5)**: `npm run build:h5`
- **Build (WeChat)**: `npm run build:mp-weixin`
- **Build (App)**: `npm run build:app-plus`
- **Code Formatting**: `npm run format`

## Coding Standards & Conventions

- **Formatting**:
  - Semi-colons: **None** (`semi: false`)
  - Quotes: **Single** (`singleQuote: true`)
  - Tab Width: **2**
  - Trailing Commas: **None** (`trailingComma: "none"`)
- **Naming**:
  - Pages and components follow kebab-case or PascalCase (standard Vue/uni-app conventions).
  - Stores are typically named after the domain they manage (e.g., `workout.ts`, `exercise.ts`).
- **Styling**:
  - Global styles are located in `src/styles/global.scss`.
  - Component-specific styles should use `<style lang="scss" scoped>`.

## Current State

The project has been successfully migrated from a React prototype. UI and core logic (workout tracking, exercise database, profile) are implemented using mock data. Navigation and tab-bar configuration are defined in `src/pages.json`.
