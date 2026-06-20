# 📖

## v1.2 修订说明：以协议契约为准

本白皮书的设计原则仍然有效，但接口与权限边界以 `HOST_PROTOCOL_CONTRACT.md` 为单一事实源。尤其注意以下修订：

1. AI 不再调用 `modify_character_status(delta)` 直接修改 HP/SAN/物品。AI 只能调用 `request_engine_resolution` 表达“玩家做了什么”，由 Python Engine 完成判定、状态写入和事件广播。
2. 由检定、伤害、暗骰、线索发现引起的公共展示必须进入 `s2c_reveal_transaction`，不能拆成先到先显示的 `roll/status/text` 零散事件。
3. 规则映射文件使用 JSON5 或受限 DSL；`condition` 不允许直接执行 Python 表达式，COC 专属规则通过插件 handler 注册。
4. RAG 权限拦截必须可审计。可以对 AI 隐藏未解锁事实，但 Engine 需要记录被拦截的 chunk、原因和请求上下文，便于排查错误。

## 一、 系统愿景与宏观边界 (Vision & Boundaries)

AI-Keeper 并非单纯的“COC跑团聊天机器人”，其核心定位是“高度解耦的通用 AI TRPG 引擎底座”。

系统采用**三层物理隔离架构**，彻底分离“表现层”、“算力层”与“逻辑层”：

1. **纯粹的展示终端 (TS/React UI)**：前端只做两件事——接收玩家指令并渲染气泡/面板/动画。前端没有任何业务逻辑，是一个纯粹的“哑终端”。

2. **绝对的核心大脑 (Python 引擎)**：系统真正的主控枢纽（类似工业设备的 PLC）。它负责维护全局状态机、事件调度、规则映射以及高权限的数据读写，并且把控系统安全。

3. **被约束的 AI 表现层 (大语言模型)**：作为高并发运算节点接入，专职负责自然语言理解与沉浸式剧情生成。大模型被彻底**剥夺了数值计算权与状态修改权**；它只能提交结算请求，不能提交状态写入。


## 二、 控制流与权力分配 (Agentic Workflow)

大模型在系统中的行为被严格束缚在“Agentic Workflow（智能体工作流）”中。

### 1. 核心交互链路

- **引擎主导，AI 请求**：大模型绝不能在文本中宣判结果（例如：“你扣除了3点HP”），也不能通过工具参数指定要扣多少。遇到检定或数值变化时，AI 只能向 Python 引擎发起标准化的 **Resolution Request (结算请求)**。

- **纯定量回归**：Python 引擎接收请求后，执行伪随机数生成、规则计算、状态落库和事件生成，再将客观事实（如 `{"roll": 95, "result": "fumble", "effects": [{"type": "hp", "after": 9}]}`）返回给 AI。

- **基于事实的润色**：AI 只能基于引擎返回的既定事实，生成最终的剧情文本展示给玩家。


### 2. 主控 AI 系统提示词 (System Prompt 框架)

必须在初始化大模型时注入以下强约束 Prompt：

> 【核心原则：你不掷骰，你只调度】 严禁私自捏造数值。当玩家行动有失败风险、或遭遇伤害/精神打击时，你【必须】暂停对话生成，调用相关工具（如 `call_roll_check`）。只有当引擎将客观结果返回给你时，你才能基于该结果生成剧情描述。 绝不向玩家透露未解锁的场景真相或隐藏线索。

## 三、 规则解耦引擎 (Rule Mapping Subsystem)

Python 引擎的核心调度层不应写死“COC”、“力量”或“大失败”的概念；但规则系统本身必须承认不同 TRPG 存在专属机制。通用部分抽象为受限 DSL/JSON5 映射，COC 奖惩骰、孤注一掷、幸运改判等特殊规则通过插件 handler 注册。未来切换至 D&D 或其他规则，应更换规则包与插件，而不是承诺“仅换 JSON 即零重构”。

**`coc_7th_rules.json` 核心片段示例**：

JSON

```
{
  "system_id": "coc_7th",
  "base_mechanic": { "dice": "1d100", "objective": "roll_under" },
  "difficulties": {
    "hard": { "multiplier": 0.5, "rounding": "floor" },
    "extreme": { "multiplier": 0.2, "rounding": "floor" }
  },
  "resolutions": [
    { "result_id": "critical_success", "condition": "roll == 1" },
    { "result_id": "fumble", "condition": "(base_target < 50 and roll >= 96) or (roll == 100)" },
    { "result_id": "failure", "condition": "roll > target" }
  ]
}
```

_引擎读取规则包，使用白名单算子解释 `condition`。禁止直接 eval Python/JS 字符串表达式。_

## 四、 带有权限锁的 RAG 记忆流 (Memory Pipeline)

采用**带权限锁的异步混合 RAG 架构**，彻底解决超长跑团的 Token 爆炸与 AI 剧透（Meta-Gaming）问题。

1. **异步切片写入**：当玩家触发场景切换或结束战斗时，Python 引擎在后台开启子线程，唤醒轻量级模型将前 20 轮对话浓缩为“客观事实文本”，附带时间戳和实体标签存入向量库。主对话流程无阻滞。

2. **主控 AI 按需召回**：当 AI 需要回忆往事时，主动发起 `search_session_memory` 工具调用。

3. **引擎级硬拦截 (物理防剧透)**：剧本的核心真相数据存入向量库时自带 `is_unlocked` 锁。如果主控 AI 不慎检出了一条未解锁的真相，Python 网关层将进行强校验并对 AI 隐藏该内容；同时写入审计日志，记录请求、chunk id 与拦截原因，确保既不剧透也不失去可调试性。


## 五、 状态机与节点控制 (State Machine & Locks)

剧本的推进不再是线性流水线，而是由 `ScenarioManager` (状态管理器) 掌控的“带有逻辑锁的有向图 (Directed Graph)”。

**`scenario_graph.json` 数据结构片段**：

JSON

```
{
  "nodes": {
    "scene_library": {
      "type": "scene",
      "transitions": [
        {
          "target": "scene_basement",
          "locks": [ {"type": "has_clue", "target_id": "clue_mayor_key", "error_msg": "门紧锁，需要特殊钥匙。"} ]
        }
      ]
    }
  }
}
```

_当大模型试图让玩家进入“地下室”时，它必须调用切场景工具。引擎的状态机校验若发现玩家未获得 `clue_mayor_key`，会直接打回报错，AI 只能根据报错乖乖告诉玩家：“门锁着过不去”。_

## 六、 核心接口契约 (Tool Calling API Schema)

这是 Python 引擎暴露给大模型的标准化 Function Calling 接口总线。

1. **`call_roll_check` (技能/属性检定)**

    - **入参**：`character_id`, `skill_name`, `difficulty`, `bonus_penalty_dice`

    - **返回事实**：`roll_value`, `result_type` (如大失败), `hint`

2. **`request_engine_resolution` (请求引擎结算)**

    - **入参**：`actor_id`, `action_text`, `context_id`, `declared_intent`

    - **返回事实**：`roll`, `result_type`, `effects`, `transaction_id`

3. **`search_session_memory` (检索RAG记忆)**

    - **入参**：`query_keywords`, `time_range`

    - **返回事实**：安全的文本事实列表

4. **`trigger_engine_event` (推进引擎状态机)**

    - **入参**：`event_type` (如 change_scene), `target_location`

    - **返回事实**：`success` (bool), `reason` (如果被状态机的锁拦截)


### 交互时序流转示例 (Micro-Sequence Flow)

**场景**：玩家尝试强行破门。

1. **User (PC)**: "我一脚踹开那扇腐朽的木门！"

2. **AI (Agent)**: 拦截文本输出，发起 Tool Call: `call_roll_check(skill="力量")`

3. **Engine (Python)**: 执行底层检定逻辑并查规则 JSON。发现大失败。 返回 Response: `{"roll": 95, "result": "fumble", "hint": "脚扭伤，扣除1点HP"}`

4. **Engine (Python)**: 根据大失败结果自动生成并落库状态变化，记录事件事务。返回 Response: `{"current_hp": 9, "transaction_id": "txn_001"}`

5. **AI (Agent)**: 基于 Engine 已落库事实生成最终回复： _"你猛地向木门踹去，伴随‘咔嚓’一声，门纹丝不动，你的脚踝却传来剧痛（力量检定大失败，扣除1点HP）。此时，门后的脚步声停顿了一下……你打算怎么做？"_
