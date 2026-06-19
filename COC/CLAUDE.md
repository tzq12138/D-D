# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 驱动的《克苏鲁的呼唤》（COC）守秘人（Keeper）系统研究与实现。包含三个主要部分：

- **`coc-ai-keeper/`** — 全栈 TypeScript 网页应用，AI 作为 KP 推进 COC 七版故事（详见子目录 CLAUDE.md）
- **根目录 Python 脚本** — 角色生成与 XLSX 角色卡填写工具
- **`TRPG-main/`** — COC 七版规则书 PDF、角色卡模板、模组资料（纯参考资源）
- **研究报告** — `人工智能驱动的《克苏鲁的呼唤》（COC）守秘人（Keeper）系统构建与部署深度研究报告.md`，涵盖 LLM 选型、规则引擎架构、SAN 机制分析等

## 常用命令

### 网页应用（coc-ai-keeper/）

```powershell
cd coc-ai-keeper
npm install              # 安装依赖
npm run dev              # 同时启动服务端 (3001) + 客户端 (5173)
npm run build            # 类型检查 + vite 生产构建
npm test                 # 运行全部测试
npx vitest run tests/cocRules.test.ts   # 运行单个测试文件
```

### Python 工具

```powershell
python gen_investigator.py    # 生成随机 COC 七版调查员角色卡（终端输出）
python fill_sheet.py          # 生成角色并填入 tzq12138.xlsx 模板
python fill_background.py     # 将背景故事写入角色卡 XLSX
python extract_pdf.py         # 提取 COC 规则书 PDF 文本内容
```

Python 脚本依赖：`openpyxl`、`PyPDF2`（标准库外）。

## 架构要点

### coc-ai-keeper（主应用）

三层 TypeScript 架构，详见 `coc-ai-keeper/CLAUDE.md`：

- **shared/** — COC 七版规则引擎（纯函数：d100 掷骰、成功等级、对抗/组合检定、SAN 检定）
- **server/** — Express + Socket.IO 后端，sql.js (WASM) 存储，DeepSeek API 集成，XLSX 角色卡解析
- **client/** — React 18 SPA，无路由库，Socket.IO 实时同步

### Python 工具链

独立脚本，无共享模块：

- `gen_investigator.py` — 完整角色生成器（属性、技能分配、背景故事），支持 8 种职业，终端可视化输出
- `fill_sheet.py` — 读取 `tzq12138.xlsx` 模板结构，将生成的角色数据填入对应单元格
- `fill_background.py` — 将详细的背景故事文本写入 XLSX 角色卡的背景区域
- `extract_pdf.py` — 扫描 COC 规则书 PDF 前 30 页，提取文本用于资料库导入

## 核心设计决策

- **DeepSeek API** 作为默认 LLM（`DEEPSEEK_API_KEY` 环境变量），无 key 时自动切换到上下文感知的模拟守秘人
- **COC 七版规则** 全部在 `shared/cocRules.ts` 中实现为纯函数，与 I/O 解耦
- **sql.js (WASM)** 替代原生 SQLite — 简化跨平台部署，数据库常驻内存，写入后刷盘
- **无认证系统** — 参与者通过 UUID 标识，存储在客户端 localStorage
- **Socket.IO 仅用于服务端→客户端推送** — 所有写操作走 REST

## 关键参考资源

- `COC7th核心规则书v1.2.1.pdf` / `COC七版基础规则.pdf` — 规则参考
- `tzq12138.xlsx` — COC 七版角色卡 Excel 模板（Python 脚本的填入目标）
- `TRPG-main/` 下的模组 PDF — 测试场景素材
- 研究报告 `.md` — AI KP 系统设计的深度技术分析，包含 SAN 机制、线索链管理、LLM 能力矩阵等
