# AGENTS.md

AI 驱动的 TRPG 主持人系统。三个独立子项目，无统一构建系统。

## 子项目边界

| 目录 | 语言 | 状态 | 入口 |
|------|------|------|------|
| `mc_system/` | Python 3 (stdlib only) | 可用引擎 | `python mc_system/cli.py` |
| `COC/coc-ai-keeper/` | TypeScript (React+Express) | 活跃开发 | `npm run dev` |
| `COC/*.py` | Python 3 | 工具脚本 | 各自独立运行 |
| 根目录 `*.md` | — | 研究报告（非代码） | — |

## 快速命令

```bash
# 剧本杀引擎（无外部依赖）
python mc_system/cli.py
python mc_system/engine.py

# COC 网页应用（需要 npm install）
cd COC/coc-ai-keeper
npm run dev          # 同时启动 server:3001 + client:5173
npm run build        # tsc 类型检查 + vite 构建（PowerShell 语法）
npm test             # vitest run
npx vitest run tests/cocRules.test.ts   # 单个测试

# COC Python 工具（需要 openpyxl, PyPDF2）
python COC/gen_investigator.py
python COC/fill_sheet.py
python COC/extract_pdf.py
```

## 必知陷阱

- **硬编码路径**：`COC/*.py` 含 `F:\D&D\COC\...` 绝对路径，换机器必须先改。
- **build 脚本用 PowerShell 语法**：`package.json` 的 `build` 用了 `if ($LASTEXITCODE ...)`，只能在 PowerShell 下运行。
- **xlsxCharacter 测试依赖外部文件**：`tests/xlsxCharacter.test.ts` 需要 `COC/tzq12138.xlsx` 存在。
- **mc_persona.md 含完整真相剧透**：是 LLM 系统提示词，绝不可向玩家展示。
- **根目录研究报告**是参考资料，不是可执行代码，不要试图运行或修改它们。
- **COC 网页应用无认证**：参与者通过 localStorage UUID 标识。
- **sql.js WASM**：数据库常驻内存，每次写入后整体刷盘，不要假设持久化语义等同原生 SQLite。
- **Socket.IO 仅做服务端→客户端推送**：所有写操作走 REST，不要通过 socket 发送写请求。
- **DeepSeek API 可选**：无 `DEEPSEEK_API_KEY` 时自动使用模拟守秘人，演示流程仍可跑通。
- **客户端无路由库**：`App.tsx` 用 `window.location.pathname` 手动分发，不要引入 react-router。

## 语言约定

- 界面和游戏内容：简体中文
- 代码标识符和注释：英文
- Python 版本：3.x（使用 dataclass、f-string、typing）
