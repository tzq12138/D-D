# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

COC AI Keeper — 本机多人联机网页应用，AI 作为守秘人推进《克苏鲁的呼唤》第七版故事，软件负责房间管理、角色状态、资料检索、掷骰与 COC 7 版核心规则判定。无 `DEEPSEEK_API_KEY` 时自动切换到上下文感知的模拟守秘人。

界面和游戏内容使用简体中文，代码标识符和注释使用英文。

## 常用命令

```powershell
npm install              # 安装依赖
npm run dev              # 同时启动服务端 (3001) + 客户端 (5173)
npm run build            # 类型检查 (tsc) + vite 生产构建
npm test                 # 运行全部测试
npm run test:watch       # 测试监听模式
```

运行单个测试文件：
```powershell
npx vitest run tests/cocRules.test.ts
```

设置 `DEEPSEEK_API_KEY` 环境变量可启用真实 AI 回复；不设置则使用模拟守秘人（演示流程仍可完整跑通）。

## 架构

三层结构，全部 TypeScript：

**`src/shared/`** — 客户端和服务端共享的类型定义 (`types.ts`) 和 COC 7 版规则引擎 (`cocRules.ts`)。规则引擎均为纯函数：`rollD100`、`evaluateSuccess`、`skillCheck`、`opposedCheck`、`combinedCheck`、`resolveSanCheck`。

**`src/server/`** — Express + Socket.IO 后端（通过 `tsx` 运行）：
- `app.ts` — REST API，路由均在 `/api` 下（房间、消息、AI 回复、掷骰、资料库、角色卡导入/更新）。每次状态变更后通过 `broadcastState()` 推送完整房间状态。
- `store.ts` — 基于 sql.js（SQLite WASM 编译版）的 `AppStore`。两个工厂函数：`createMemoryStore()` 用于测试，`createFileStore(path)` 用于生产。每次写入后将整个数据库以二进制刷盘。
- `ai.ts` — DeepSeek API 集成，要求结构化 JSON 输出（`narrative`、`rollRequest`、`stateSuggestions`、`keeperNotes`）。API 调用失败时自动回退到模拟模式。
- `library.ts` — 导入 `.md/.txt/.pdf` 文件，按段落分块（最大 900 字符），支持中文 bigram 关键词搜索。
- `xlsxCharacter.ts` — 解析 COC 7 版 XLSX 角色卡（"人物卡"/"简化卡" 工作表）。

**`src/client/`** — React 18 SPA（Vite 构建）：
- 无路由库 — `App.tsx` 根据 `window.location.pathname` 分发页面（`/`、`/room/:id`、`/keeper/:id`、`/library`）。
- `hooks.ts` — `useRoomState(roomId)` 通过 REST 获取初始状态，订阅 Socket.IO 实时更新。
- `api.ts` — 类型化 fetch 封装。默认 API 地址 `http://127.0.0.1:3001`（可通过 `VITE_API_URL` 覆盖）。
- 纯 CSS + 自定义属性，暗色主题，900px 响应式断点。

## 核心设计决策

- **无认证系统** — 参与者通过 UUID 标识，存储在客户端 `localStorage` 中。
- **Socket.IO 仅用于服务端→客户端推送** — 所有写操作走 REST，服务端写入后广播。
- **sql.js (WASM)** 替代原生 SQLite 绑定 — 简化跨平台部署，数据库常驻内存，写入后刷盘。
- **强制掷骰** — 掷骰 API 接受 `forced: { unit, tens }` 参数，用于测试和守秘人覆盖的确定性结果。
- **模拟 AI 具有规则感知** — 根据行动文本中的关键词（图书馆、暗门等）生成上下文相关的检定请求。

## 测试

Vitest 1.6，jsdom 环境，globals 已启用。配置见 `tests/setup.ts`。

| 文件 | 覆盖范围 |
|------|----------|
| `tests/cocRules.test.ts` | 骰子机制、成功等级、对抗/组合检定、SAN |
| `tests/store.test.ts` | SQLite 存储 CRUD（内存模式） |
| `tests/library.test.ts` | 文本分块、中文关键词搜索 |
| `tests/ai.test.ts` | 模拟守秘人响应结构 |
| `tests/api.test.ts` | HTTP 集成测试（node 环境，随机端口） |
| `tests/ui.test.tsx` | React 组件渲染 |
| `tests/xlsxCharacter.test.ts` | XLSX 解析器（依赖外部文件 `../tzq12138.xlsx`） |

## 环境变量

| 变量 | 必填 | 默认值 | 用途 |
|------|------|--------|------|
| `DEEPSEEK_API_KEY` | 否 | — | 启用真实 AI；省略则使用模拟模式 |
| `DEEPSEEK_MODEL` | 否 | `deepseek-v4-pro` | DeepSeek API 模型名称 |
| `SOURCES_DIR` | 否 | `./sources` | 知识文档扫描目录 |
| `PORT` | 否 | `3001` | 服务端监听端口 |
| `VITE_API_URL` | 否 | `http://127.0.0.1:3001` | 客户端 API 基础地址 |
