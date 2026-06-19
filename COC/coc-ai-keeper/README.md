# COC AI Keeper

AI 驱动的《克苏鲁的呼唤》第七版守秘人系统。本机多人联机网页应用，AI 扮演守秘人推进调查故事，软件负责房间管理、角色状态、资料检索、掷骰与 COC 7 版核心规则判定。

## 核心特性

- **AI 守秘人**：自动生成叙事回应、触发检定、引用资料（支持 DeepSeek API 或模拟模式）
- **COC 7e 规则引擎**：完整的 d100 掷骰系统、成功等级判定、对抗/组合检定、SAN 检定
- **多人实时联机**：守秘人 + 多名玩家通过 Socket.IO 实时同步
- **角色卡导入**：支持 XLSX 格式的 COC 7e 角色卡
- **资料库检索**：中文 bigram 关键词搜索，AI 自动引用相关资料

## 快速开始

### 一键启动（推荐）

**Windows**：
```powershell
.\start.ps1
```

**macOS / Linux**：
```bash
chmod +x start.sh
./start.sh
```

### 手动启动

```powershell
cd coc-ai-keeper
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。没有 `DEEPSEEK_API_KEY` 时会自动使用模拟守秘人，仍可跑通完整演示流程。

### 使用 DeepSeek API

1. 访问 https://platform.deepseek.com/ 获取 API Key
2. 复制 `.env.example` 为 `.env`
3. 添加 `DEEPSEEK_API_KEY=sk-your-key-here`
4. 重启系统

## 演示场景

项目包含一个完整的演示剧本：**阿卡姆图书馆暗门**

- `demo/scenario.md` - 剧本文档（背景、线索、NPC、场景划分）
- `demo/characters/` - 预置角色卡（JSON 格式）
- `demo/sources/` - 示例资料（技能说明、阿卡姆镇历史、调查技巧）

**演示流程**：
1. 启动系统，创建房间
2. 守秘人和 2 名玩家加入房间
3. 守秘人导入示例资料
4. 玩家导入预置角色卡
5. 按剧本推进：调查 → 掷骰 → AI 叙事 → 发现线索

## 资料导入

- 将 `.md`、`.txt`、`.pdf` 放入 `sources/`，在页面点击"扫描本地 sources"
- 或在"资料库"页面直接上传资料文件
- 如需扫描本仓库上级目录的现有 COC 资料，可启动前设置：

```powershell
$env:SOURCES_DIR="F:\D&D\COC"
npm run dev
```

## 项目结构

```
coc-ai-keeper/
├── src/
│   ├── shared/        # 共享类型和规则引擎
│   ├── server/        # Express + Socket.IO 后端
│   └── client/        # React 18 前端
├── tests/             # Vitest 测试套件
├── demo/              # 演示场景（剧本、角色、资料）
├── docs/              # 用户文档
├── sources/           # 知识文档目录
├── start.ps1          # Windows 一键启动
├── start.sh           # macOS/Linux 一键启动
└── .env.example       # 环境变量示例
```

## 文档

- [用户手册](docs/user-manual.md) - 玩家操作指南
- [守秘人指南](docs/keeper-guide.md) - 守秘人控制台使用
- [故障排除](docs/troubleshooting.md) - 常见问题和解决方案

## 技术栈

- **前端**：React 18 + Vite + TypeScript
- **后端**：Express + Socket.IO + TypeScript
- **数据库**：sql.js (SQLite WASM)
- **AI**：DeepSeek API（可选，无 API 时使用模拟模式）
- **测试**：Vitest + Testing Library

## 开发命令

```powershell
npm install              # 安装依赖
npm run dev              # 启动开发服务器（客户端 5173 + 服务端 3001）
npm run build            # 生产构建
npm test                 # 运行测试
npm run test:watch       # 测试监听模式
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DEEPSEEK_API_KEY` | 否 | - | DeepSeek API Key，不设置则使用模拟 AI |
| `DEEPSEEK_MODEL` | 否 | `deepseek-v4-pro` | DeepSeek 模型名称 |
| `SOURCES_DIR` | 否 | `./sources` | 知识文档扫描目录 |
| `PORT` | 否 | `3001` | 服务端端口 |
| `VITE_API_URL` | 否 | `http://127.0.0.1:3001` | 客户端 API 地址 |

## 许可证

MIT
