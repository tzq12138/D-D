# Host 协议契约 v1.2

本文是 Host 端通信协议的单一事实源。Python Engine、AI Tool Schema、React Host 端类型定义必须以本文为准；其他模块文档中的示例代码若与本文冲突，以本文为准。

## 1. 权限边界

- AI 只能提出“意图”和“结算请求”，不能直接写入角色状态、物品、线索或场景进度。
- Engine 是唯一状态写入者。所有 HP/SAN/物品/线索/场景变更必须由 Engine 生成、校验、落库并广播。
- Host 是公共演出终端，只消费事件日志，不承载业务判定。
- Player 端可以提交玩家动作，但不能直接修改权威状态。

## 2. 标准信封

所有服务端到 Host 的消息都使用统一信封：

```ts
export interface HostEvent<T = unknown> {
  eventId: string;
  roomId: string;
  type: HostEventType;
  issuedAt: number;
  sequence: number;
  payload: T;
}
```

`sequence` 是房间级单调递增序号。Host 端必须按序处理；重连后可用 `lastSequence` 请求补发。

## 3. 事件类型

```ts
export type HostEventType =
  | 's2c_reveal_transaction'
  | 's2c_chat_stream'
  | 's2c_atmosphere'
  | 's2c_engine_state'
  | 's2c_scene_sync'
  | 's2c_status_sync';
```

`s2c_status_sync` 只用于非剧透的后台同步，例如初始房间快照。任何由检定、伤害、暗骰、线索发现引起的状态变化都必须放进 `s2c_reveal_transaction`。

## 4. 防剧透事务

所有需要演出顺序的内容必须打包为事务：

```ts
export interface RevealTransactionPayload {
  transactionId: string;
  lockToken: string;
  priority: 'normal' | 'urgent';
  steps: RevealStep[];
}

export type RevealStep =
  | { kind: 'roll'; payload: RollEventPayload }
  | { kind: 'status_delta'; payload: StatusDeltaPayload }
  | { kind: 'scene_transition'; payload: SceneSyncPayload }
  | { kind: 'narrative_stream'; streamId: string };
```

Host 处理事务时必须先上锁，再按 `steps` 顺序演出。只有持有同一个 `lockToken` 的组件可以解锁；若超时，watchdog 触发降级解锁并显示错误状态。

## 5. 流式文本

```ts
export interface ChatStreamPayload {
  streamId: string;
  seq: number;
  role: 'keeper' | 'system' | 'npc';
  speakerName?: string;
  chunk: string;
  isFinal: boolean;
}
```

Host 不得把所有 chunk 追加到“最后一条消息”。必须按 `streamId` 聚合，按 `seq` 排序，收到 `isFinal` 后关闭该流。

## 6. 掷骰与状态变更

```ts
export interface RollEventPayload {
  rollId: string;
  characterId: string;
  skillName: string;
  diceType: string;
  rolledValue: number;
  targetValue: number;
  resultType:
    | 'critical_success'
    | 'extreme_success'
    | 'hard_success'
    | 'regular_success'
    | 'failure'
    | 'fumble';
  label: string;
}

export interface StatusDeltaPayload {
  characterId: string;
  hp?: { before: number; after: number; max: number };
  san?: { before: number; after: number; max: number };
  mp?: { before: number; after: number; max: number };
  luck?: { before: number; after: number; max: number };
  tagsAdded?: string[];
  tagsRemoved?: string[];
}
```

状态变更由 Engine 直接附在事务里。AI 不再调用 `modify_character_status(delta)`。

## 7. 氛围协议

```ts
export interface AtmospherePayload {
  visual?: {
    filter?: 'deep_red' | 'cold_blue' | 'sepia' | 'darkness';
    vignette?: number;
    shake?: { intensity: 'low' | 'medium' | 'high'; durationMs: number };
    glitch?: boolean;
  };
  bgm?: {
    trackId: string | null;
    volume: number;
    fadeInMs: number;
  };
  sfx?: Array<{ clipId: string; volume?: number }>;
}
```

字段统一使用 camelCase。旧文档中的 `track`、`fade_in` 视为废弃写法。

## 8. AI 工具边界

AI 可用工具应表达请求，不表达写入：

```ts
request_engine_resolution(actionText, actorId, contextId)
search_session_memory(queryKeywords, timeRange)
request_scene_transition(targetLocation)
request_atmosphere_hint(mood, intensity)
```

Engine 返回事实和已落库事件。若需要人工确认，可返回 `requiresKeeperApproval: true`，但不允许 AI 自行提交状态写入。

## 9. 规则映射格式

规则文件使用 JSON5 或受限 DSL，不使用可执行 Python 表达式。`condition` 必须由白名单算子组成，例如：

```json
{ "op": "lte", "left": { "var": "roll" }, "right": { "var": "target" } }
```

COC 奖惩骰、孤注一掷、幸运改判等系统特性由 `rulePluginHandlers` 注册，不能伪装成完全通用 JSON 字符串表达式。
