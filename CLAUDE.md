# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作提供指导。

## 项目概述

AI 驱动的桌面角色扮演游戏主持人系统研究与实现，横跨三个领域：

| 领域 | 状态 | 核心产物 |
|------|------|----------|
| **D&D**（龙与地下城） | 研究阶段 | 根目录研究报告 |
| **COC**（克苏鲁的呼唤） | 活跃开发 | 网页应用（`COC/coc-ai-keeper/`）+ Python 工具（`COC/*.py`） |
| **剧本杀**（Jubensha） | 可用引擎 | Python MC 引擎（`mc_system/`）+ 两个实体剧本 |

根目录三份大型 `.md` 研究报告是各自的深度技术分析文档，涵盖 LLM 选型、规则引擎架构、多智能体设计与部署策略。它们是参考资料，非实现代码。

## 仓库地图

```
D&D/
├── mc_system/                  # 剧本杀 Python MC 引擎（"再见卡门"）
│   ├── engine.py               #   游戏状态、角色数据、线索系统、分幕控制器
│   ├── cli.py                  #   交互式测试 CLI，封装 engine.py
│   └── mc_persona.md           #   LLM 系统提示词（含剧透真相——敏感文件）
├── extract_docx.py             # 从 .docx 剧本文件中提取文本（仅用标准库）
├── 剧本杀/                      # 实体剧本杀资料
│   ├── 021再见卡门（4人开放）/   #   "再见卡门"——mc_system/ 已实现引擎
│   └── 022洛希极限（4人开放）/   #   "洛希极限"——仅有资料，尚无引擎
├── COC/                        # COC 子系统——详见 COC/CLAUDE.md
│   ├── coc-ai-keeper/          #   全栈 TypeScript 网页应用（React+Express+Socket.IO）
│   ├── *.py                    #   调查员生成器 + XLSX 角色卡填写 + PDF 提取
│   └── TRPG-main/              #   COC 七版规则书 PDF + 角色卡模板 + 模组 PDF
├── .obsidian/                  # Obsidian 知识库配置（用于浏览研究笔记）
├── *.md                        # 三份 AI 主持人研究报告（D&D、COC、剧本杀）
└── CLAUDE.md                   # 本文件
```

## 常用命令

### 剧本杀 MC 引擎（根目录 / mc_system/）

```bash
# 交互式 CLI——多人回合制游戏测试工具
python mc_system/cli.py

# 独立运行引擎模块（打印角色/地点数量）
python mc_system/engine.py

# 提取剧本中所有 .docx 文件的文本
python extract_docx.py
```

剧本杀引擎仅使用 Python 标准库，无外部依赖。

### COC 子系统

COC 全部命令见 `COC/CLAUDE.md`。快速参考：

```bash
# 网页应用
cd COC/coc-ai-keeper && npm install && npm run dev

# Python 工具（需要 openpyxl、PyPDF2）
python COC/gen_investigator.py    # 随机生成 COC 七版调查员角色卡
python COC/fill_sheet.py          # 生成角色并填入 XLSX 模板
python COC/fill_background.py     # 将背景故事写入角色卡 XLSX
python COC/extract_pdf.py         # 提取 COC 规则书 PDF 文本
```

**注意：** COC Python 脚本中包含硬编码的绝对路径（如 `F:\D&D\COC\...`），换机器运行前需要修改路径。

## 架构：剧本杀 MC 引擎（`mc_system/`）

引擎实现了一个回合制谋杀谜案游戏，对应 **《再见卡门》**——一部 1845 年西班牙塞维利亚背景的 4 人开放剧本杀。

**游戏流程（5 幕）：**
- ACT 0：角色分配
- ACT 1：剧本阅读阶段
- ACT 2：第一轮搜证（每人 5 AP）+ 讨论
- ACT 3：第二轮搜证（每人 6 AP）+ 讨论 + 命运之门解锁
- ACT 4：填写答卷 + 最终投票 + 真相揭示

**核心数据结构（`engine.py`）：**
- `GameState`——阶段、轮次、公开线索、命运字母揭示情况、讨论日志
- `PlayerState`——AP 追踪（总量/已用）、已收集线索、投票、答卷
- `CHARACTERS` 字典——4 名角色（占卜师、何塞、旅人、米里奥），各有线索、禁止暴露的秘密、地图字母
- `SCENE_CLUES` 字典——按地点组织的线索（`corpse_N`、`scene1_N`、`scene2_N`）

**核心机制——核心诡计：** 四位角色是同一个男人在不同年龄穿越回来：唐·何塞 → 米里奥 → 旅人 → 占卜师。每人手中地图的一个字母拼起来是 **FATE（命运）**。占卜师是真凶——他应卡门自己的请求开枪打死了她。

**`cli.py`** 将 `engine.py` 封装为交互式多人命令行界面。指令：`read <角色>`（查看角色剧本）、`search <地点>`（消耗 AP 搜证）、`deep <线索ID>`（深入调查）、`fate <字母>`（揭示命运字母）、`vote <目标>`、`unlock <单词>`（解锁命运之门）。

**`mc_persona.md`** 是面向 LLM 的 MC 系统提示词。定义了人设规则（公正性、严格信息隔离、流程控制），并包含完整真相概要——**敏感文件，绝不可向玩家展示。**

## 剧本杀实体资料（`剧本杀/`）

两个实体剧本：

- **021再见卡门（4人开放）**——`mc_system/` 已完整实现引擎。包含人物剧本（.docx）、线索清单、组织者手册、答卷、案发现场地图（.jpg）。
- **022洛希极限（4人开放）**——仅有资料（角色剧本扫描图、组织者手册扫描图、尾声 .mp3）。尚无引擎实现；角色为 阿路法、克莉丝汀、年迈的老者、星石。

使用 `extract_docx.py` 可提取任一剧本中的 `.docx` 文件文本。

## 关键细节

- Python 版本：3.x（引擎使用了标准库 dataclass、f-string、typing）
- `.obsidian/graph.json` 保存 Obsidian 知识库图谱视图偏好——三份研究 `.md` 文件设计为在 Obsidian 中作为互联知识图谱浏览
- 三份根目录研究报告遵循共同结构：市场分析 → 架构设计 → LLM 选型 → 部署策略；剧本杀报告明确以前两份 D&D 和 COC 报告为基础
- `COC/PLAN.md` 是 COC 网页应用的原始设计方案——理解架构意图的有用参考
- 根目录无构建系统、包管理器或测试套件
