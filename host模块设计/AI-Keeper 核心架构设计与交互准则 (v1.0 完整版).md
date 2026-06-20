
## v1.1 修订说明：Engine 原子结算

本文中的整体架构仍然保留，但工具接口以 `HOST_PROTOCOL_CONTRACT.md` 为准。关键修订如下：

- AI 不拥有状态修改权。`modify_character_status` 不再作为 AI 可直接调用的公开工具。
- AI 的职责是提交玩家动作与叙事意图；Engine 的职责是判定、落库、生成防剧透演出事务。
- Host 端只能消费 `s2c_reveal_transaction` 等标准事件，不应依赖零散 WebSocket 消息自行推断演出顺序。

## 第一部分：核心架构设计总览

### 1. 核心愿景与系统边界 (Core Vision & Boundaries)

项目的终极目标并非单纯的“COC 跑团模拟器”，而是**打造一套高度解耦的“通用 AI TRPG 引擎底座”**。COC 第七版规则仅仅是这套引擎挂载的第一个“测试协议”。 系统采用**三层物理隔离架构**：

- **终端交互层 (TS/React UI)**：纯粹的“哑终端”。不包含业务逻辑，仅负责接收玩家输入、渲染气泡、播放掷骰动画和展示面板。

- **核心控制大脑 (Python 引擎)**：系统的绝对主控（类似工业控制中的 PLC）。负责维护全局状态机、事件调度、规则映射以及高权限的数据读写。

- **AI 算力与表现层 (大语言模型)**：作为高并发的运算节点接入，专职负责自然语言的理解与剧情的沉浸式生成。


### 2. 控制流与权力分配 (Control Flow)

系统摒弃了让 AI 自由发挥的危险做法，采用 **Agentic Workflow（智能体工作流）**：

- **引擎主导，AI 请求**：大模型被剥夺了数值计算权和状态修改权。它不能直接宣判结果，也不能用工具参数指定状态变化；它只能向 Python 引擎发起标准化的结算请求。

- **纯定量回归**：Python 引擎执行冷酷的伪随机数生成与查表计算，再将客观事实（如“大失败，扣 1 HP”）返回给 AI，AI 只能基于该事实生成润色。

- **规则解耦**：Python 引擎内部不写死 COC 逻辑，而是通过加载外部的 **JSON 规则映射表**进行判定。


### 3. RAG 记忆流与防剧透机制 (Memory Pipeline)

采用**带权限锁的异步混合 RAG 架构**：

- **异步切片记录**：当玩家触发“场景切换”等节点时，引擎在后台开启子线程，利用轻量级模型将前 20 轮对话浓缩提炼为“客观事实”，存入向量库，不阻塞主流程。

- **按需召回**：主控 AI 主动调用 `search_session_memory` 工具进行混合检索。

- **引擎级硬拦截**：剧本真相数据自带 `is_unlocked` 状态锁。若未触发相关节点，即使向量库召回了该真相，Python 网关也会对 AI 隐藏该内容，并写入审计日志，物理层面杜绝 Meta-Gaming（剧透）。


## 第二部分：AI 交互准则与接口契约

### 1. 主控 AI 系统提示词 (System Prompt)

在初始化大模型时，必须注入以下系统指令，确立其行为边界：

Plaintext

```
【角色设定】
你是一个专业的《克苏鲁的呼唤(COC)》第七版守秘人(Keeper)。你的任务是引导玩家进行跑团游戏，提供充满洛夫克拉夫特式恐怖氛围的场景描述，扮演所有NPC，并根据玩家的行动推进剧情。

【核心原则：你不掷骰，你只调度】
1. 严禁私自捏造数值：你绝不能自己在文本中宣布“你扣除了 3 点 HP”或“你掷出了 45，成功了”。
2. 必须使用工具：当玩家的行动包含不确定性（如寻找线索、攻击、说服）、或者遭遇伤害/精神打击时，你【必须】立即暂停对话生成，调用系统提供的结算工具（如 `request_engine_resolution`）。
3. 纯文本回归：只有当 Python 引擎将掷骰结果、状态变动和事件事务通过 Tool Response 返回给你时，你才能根据该客观结果生成最终的剧情描述。

【记忆与剧透限制】
1. 当玩家询问过去发生的事情，且不在你的短期记忆中时，优先调用 `search_session_memory` 工具。
2. 绝不向玩家透露他们未探索到的场景真相、NPC的隐藏动机或需要检定才能发现的线索。

【交互风格】
- 语言风格：沉浸、悬疑、客观。不要说“我是 AI”，不要对玩家的行为做道德评价。
- 回复长度：每次回复控制在 100-200 字，除非是重大场景介绍。永远在描述结尾把主动权交还给玩家（例如：“你打算怎么做？”）。
```

### 2. 核心 Tool Schema (AI 工具箱 API)

这是 Python 引擎暴露给大模型的标准化 Function Calling 接口。

#### 2.1 技能与属性检定 (`call_roll_check`)

当玩家的行动有失败风险时调用。

JSON

```
{
  "name": "call_roll_check",
  "description": "当玩家的行动有失败风险（如侦查、攀爬、交涉、战斗）时调用此工具。",
  "parameters": {
    "type": "object",
    "properties": {
      "character_id": {
        "type": "string",
        "description": "发起检定的角色ID（如 'player_1'）"
      },
      "skill_name": {
        "type": "string",
        "description": "需要检定的技能或属性名称（如 '侦查', '力量'）"
      },
      "difficulty": {
        "type": "string",
        "enum": ["regular", "hard", "extreme"],
        "description": "检定难度：常规(regular)、困难(hard)或极难(extreme)。默认 regular。"
      },
      "bonus_penalty_dice": {
        "type": "integer",
        "description": "奖惩骰数量。正数为奖励骰，负数为惩罚骰。默认 0。"
      }
    },
    "required": ["character_id", "skill_name"]
  }
}
```

#### 2.2 引擎原子结算 (`request_engine_resolution`)

用于请求 Engine 结算玩家动作。该工具不接受 `delta`，也不允许 AI 指定“扣几点 HP”。所有状态变化由 Engine 根据规则、场景和权限锁自动生成。

JSON

```
{
  "name": "request_engine_resolution",
  "description": "当玩家动作需要规则判定、状态变化或线索解锁时调用。Engine 将完成判定、落库并返回事实。",
  "parameters": {
    "type": "object",
    "properties": {
      "actor_id": {
        "type": "string",
        "description": "发起行动的角色ID"
      },
      "action_text": {
        "type": "string",
        "description": "玩家原始行动文本"
      },
      "declared_intent": {
        "type": "string",
        "description": "AI 对玩家意图的结构化理解，例如 break_door / search_clue / persuade_npc"
      },
      "context_id": {
        "type": "string",
        "description": "当前场景、战斗或交互节点ID"
      }
    },
    "required": ["actor_id", "action_text", "declared_intent", "context_id"]
  }
}
```

#### 2.3 记忆检索 (`search_session_memory`)

用于主动从 RAG 向量库中提取长期记忆。

JSON

```
{
  "name": "search_session_memory",
  "description": "当玩家询问过去发生的事情、NPC的特征，且你短期记忆中没有时调用此工具。",
  "parameters": {
    "type": "object",
    "properties": {
      "query_keywords": {
        "type": "array",
        "items": {"type": "string"},
        "description": "用于检索的关键词（如 ['镇长', '钥匙', '地下室']）"
      },
      "time_range": {
        "type": "string",
        "enum": ["recent", "distant", "all"],
        "description": "搜索的时间范围偏好。"
      }
    },
    "required": ["query_keywords"]
  }
}
```

#### 2.4 引擎事件触发 (`trigger_engine_event`)

用于通知 Python 引擎推进内部状态机（如触发后台总结记忆任务）。

JSON

```
{
  "name": "trigger_engine_event",
  "description": "当玩家明确表示移动到新地点，或进入/退出战斗状态时调用。",
  "parameters": {
    "type": "object",
    "properties": {
      "event_type": {
        "type": "string",
        "enum": ["change_scene", "enter_combat", "end_combat"]
      },
      "target_location": {
        "type": "string",
        "description": "如果 event_type 是 change_scene，填写新的地点名称。"
      }
    },
    "required": ["event_type"]
  }
}
```

### 3. 交互时序流转示例 (Micro-Sequence Flow)

**场景**：玩家尝试强行破门。

1. **User (PC)**: "我一脚踹开那扇腐朽的木门！"

2. **AI (Agent)**: 拦截文本输出，发起 Tool Call: `call_roll_check(character_id="player", skill_name="力量", difficulty="regular")`

3. **Engine (Python)**: 执行底层检定逻辑、落库状态变化，并创建防剧透演出事务。返回 Response: `{"roll": 95, "target": 50, "result": "fumble", "effects": [{"type": "hp", "before": 10, "after": 9}], "transaction_id": "txn_001"}`

4. **AI (Agent)**: 整合 Engine 已确认的事实，生成最终回复： _"你猛地向木门踹去，伴随‘咔嚓’一声，门纹丝不动，你的脚踝却传来剧痛（力量检定大失败，扣除1点HP）。此时，门后的脚步声停顿了一下……你打算怎么做？"_
