# PRD - Phase 1: 基础架构与规则引擎

**版本**: 1.0
**状态**: ✅ 已完成
**作者**: AI守秘人系统团队
**创建日期**: 2026-05-21
**完成日期**: 2026-05-25

---

## 1. 背景与动机

### 1.1 从研究到实施的跨越

Phase 0完成了深度研究报告，明确了COC AI KP系统的核心技术挑战和实施路径。Phase 1的目标是将研究成果转化为可运行的代码基础：

1. **搭建项目基础架构**：前后端分离、TypeScript类型安全、构建工具链配置
2. **实现COC 7e核心规则引擎**：将纸面规则转化为可执行的代码逻辑
3. **建立数据存储层**：为房间、角色、消息、资料等核心数据提供持久化方案

### 1.2 为什么Phase 1至关重要？

COC 7e的规则引擎是整个人工智能KP系统的"骨骼"——它决定了：
- 掷骰结果的判定逻辑（常规/困难/极限/大成功/大失败）
- SAN（理智）损失的数值计算和临时疯狂触发
- 奖励骰/惩罚骰的特殊判定规则
- 对抗检定和组合检定的胜负判断

如果规则引擎实现有误，整个系统的可信度将崩塌。因此，Phase 1必须将规则引擎的正确性放在首位。

---

## 2. 目标与范围

### 2.1 核心目标

1. **初始化项目结构**
   - 创建 `client/`、`server/`、`shared/` 三层目录结构
   - 配置TypeScript、Vite、Express、Socket.IO、Vitest

2. **定义核心数据类型**
   - 在 `shared/types.ts` 中定义所有跨前后端共享的类型
   - 确保类型安全贯穿整个系统

3. **实现COC 7e规则引擎**
   - 在 `shared/cocRules.ts` 中实现所有核心判定逻辑
   - 通过严格的单元测试保证规则计算的正确性

4. **实现数据存储层**
   - 在 `server/store.ts` 中实现基于SQL.js（浏览器内SQLite）的持久化方案
   - 支持房间、参与者、调查员、消息、知识片段的CRUD操作

### 2.2 范围边界

**包含**：
- 项目基础结构搭建
- 核心数据类型定义
- COC 7e规则引擎实现（d100掷骰、技能检定、SAN检定、对抗检定、组合检定）
- 数据存储层实现（SQL.js）
- 构建配置（Vite、TypeScript、Vitest）

**不包含**：
- 后端API实现（Phase 2）
- 前端页面和组件实现（Phase 2）
- AI集成（Phase 2）
- 测试编写（Phase 3，但Phase 1需完成规则引擎的核心单元测试）

---

## 3. 用户故事

### 3.1 作为开发者，我需要...

| ID | 用户故事 | 优先级 |
|----|----------|----------|
| US-1-1 | 作为开发者，我需要项目有清晰的三层目录结构（client/server/shared），以便前后端代码分离且共享类型定义 | P0 |
| US-1-2 | 作为开发者，我需要核心数据类型有完整的定义和类型注释，以便在开发过程中获得IDE智能提示和编译时类型检查 | P0 |
| US-1-3 | 作为开发者，我需要COC 7e规则引擎正确实现d100掷骰、技能检定、SAN检定等核心逻辑，以便后续功能可以依赖可信的规则计算 | P0 |
| US-1-4 | 作为开发者，我需要数据存储层支持所有核心数据的CRUD操作，以便在API实现时可以持久化游戏状态 | P0 |
| US-1-5 | 作为开发者，我需要构建工具链（Vite、TypeScript、Vitest）正确配置，以便在开发过程中可以享受热更新、类型检查和单元测试的便利 | P1 |

### 3.2 作为测试人员，我需要...

| ID | 用户故事 | 优先级 |
|----|----------|----------|
| US-1-6 | 作为测试人员，我需要规则引擎有完整的单元测试覆盖，以便确信规则计算的正确性 | P0 |
| US-1-7 | 作为测试人员，我需要存储层有基本的单元测试覆盖，以便确信数据持久化的正确性 | P1 |

---

## 4. 功能需求

### 4.1 项目结构初始化

**描述**：创建清晰、可维护的项目目录结构。

**目录结构**：
```
coc-ai-keeper/
├── client/               # 前端React应用
│   ├── api.ts          # API调用封装
│   ├── main.tsx        # 入口
│   ├── App.tsx         # 主应用路由
│   ├── components/      # React组件
│   ├── pages/          # 页面组件
│   ├── hooks.ts        # 自定义Hooks
│   └── vite-env.d.ts # Vite类型声明
├── server/              # 后端Express服务
│   ├── index.ts        # 服务器入口
│   ├── app.ts          # Express应用配置
│   ├── ai.ts           # AI集成（DeepSeek API）
│   ├── library.ts      # 资料库管理
│   ├── store.ts        # 数据存储层
│   └── xlsxCharacter.ts # Excel角色卡解析
├── shared/              # 前后端共享
│   ├── types.ts        # 核心数据类型定义
│   └── cocRules.ts    # COC 7e规则引擎
├── tests/               # 测试文件
├── sources/             # 本地资料文件夹
├── uploads/             # 上传文件临时目录
├── dist/                # 构建输出目录
├── package.json         # npm配置
├── tsconfig.json       # TypeScript配置
├── vite.config.ts      # Vite配置
└── vitest.config.ts    # Vitest配置
```

**验收标准**：
- ✅ 目录结构创建完成
- ✅ `package.json` 配置完成（含所有依赖和scripts）
- ✅ `tsconfig.json` 配置完成（编译选项、路径别名）
- ✅ `vite.config.ts` 配置完成（React插件、代理设置）
- ✅ `vitest.config.ts` 配置完成（测试环境、Setup文件）

### 4.2 核心数据类型定义

**描述**：在 `shared/types.ts` 中定义所有跨前后端共享的核心数据类型。

**核心类型列表**：

1. **Difficulty**: `'regular' | 'hard' | 'extreme'`
2. **SuccessLevel**: `'critical' | 'extreme' | 'hard' | 'regular' | 'failure' | 'fumble'`
3. **Visibility**: `'public' | 'keeper' | 'private'`

4. **Room**: 房间
   ```typescript
   interface Room {
     id: string;
     name: string;
     currentScene: string;
     createdAt: string;
   }
   ```

5. **Participant**: 参与者
   ```typescript
   interface Participant {
     id: string;
     roomId: string;
     name: string;
     role: 'keeper' | 'player';
     investigatorId?: string;
     joinedAt: string;
   }
   ```

6. **Investigator**: 调查员角色卡
   ```typescript
   interface Investigator {
     id: string;
     roomId: string;
     ownerParticipantId?: string;
     name: string;
     occupation: string;
     age: number;
     attributes: Record<string, number>;
     derived: {
       hp: { current: number; max: number };
       san: { current: number; max: number };
       luck: { current: number; max: number };
       mp: { current: number; max: number };
       move: number;
       damageBonus: string;
       build: number;
     };
     skills: Record<string, number>;
     possessions: string[];
     wounds: string[];
     conditions: string[];
     growthMarks: string[];
   }
   ```

7. **DiceTerm** & **DiceExpression**: 骰子表达式
   ```typescript
   interface DiceTerm {
     count: number;
     sides: number;
   }
   
   interface DiceExpression {
     dice: DiceTerm[];
     modifier: number;
   }
   ```

8. **RollRequest**: 掷骰请求
   ```typescript
   interface RollRequest {
     id: string;
     type: 'skill' | 'opposed' | 'combined' | 'san';
     label: string;
     skillName?: string;
     suggestedSkills?: string[];
     skillValue?: number;
     difficulty?: Difficulty;
     bonusDice?: number;
     penaltyDice?: number;
     sanExpression?: string;
     reason: string;
     visibility: Visibility;
   }
   ```

9. **D100Roll**: d100掷骰结果
   ```typescript
   interface D100Roll {
     total: number;
     unit: number;
     tens: number[];
     selectedTens: number;
     bonusDice: number;
     penaltyDice: number;
   }
   ```

10. **SkillCheckResult**: 技能检定结果
    ```typescript
    interface SkillCheckResult {
      type: 'skill';
      skillName: string;
      skillValue: number;
      difficulty: Difficulty;
      roll: D100Roll;
      level: SuccessLevel;
      passed: boolean;
    }
    ```

11. **SanEvent**: SAN事件
    ```typescript
    interface SanEvent {
      expression: string;
      sanRoll: number;
      success: boolean;
      loss: number;
      oldSan: number;
      newSan: number;
      temporaryInsanity?: {
        active: boolean;
        intRoll: number;
        bout: InsanityBout;
      };
    }
    ```

12. **InsanityBout**: 疯狂发作
    ```typescript
    interface InsanityBout {
      roll: number;
      name: string;
      description: string;
    }
    ```

13. **KnowledgeChunk**: 知识片段
    ```typescript
    interface KnowledgeChunk {
      id: string;
      sourceName: string;
      sourceType: string;
      index: number;
      text: string;
      createdAt: string;
    }
    ```

14. **KeeperResponse**: 守秘人回应
    ```typescript
    interface KeeperResponse {
      narrative: string;
      rollRequest?: RollRequest;
      stateSuggestions: string[];
      keeperNotes: string;
      sources: Array<{ sourceName: string; excerpt: string }>;
    }
    ```

15. **Message**: 消息
    ```typescript
    interface Message {
      id: string;
      roomId: string;
      senderId?: string;
      senderName: string;
      type: 'system' | 'player' | 'keeper' | 'ai' | 'roll';
      text: string;
      visibility: Visibility;
      metadata?: Record<string, unknown>;
      createdAt: string;
    }
    ```

**验收标准**：
- ✅ 所有核心类型已定义
- ✅ 类型定义通过TypeScript编译检查
- ✅ 类型定义在前端和后端代码中均可正确导入

### 4.3 COC 7e规则引擎实现

**描述**：在 `shared/cocRules.ts` 中实现COC 7e核心规则引擎。

#### 4.3.1 d100掷骰逻辑

**功能描述**：
- 实现标准的d100掷骰（1-100）
- 支持奖励骰（额外掷一个十位骰，取较小值）
- 支持惩罚骰（额外掷一个十位骰，取较大值）
- 处理特殊规则：掷出00时，如果个位也是0，则结果为100（大成功）

**核心函数**：
```typescript
function rollD100(options: D100Options = {}): D100Roll
```

**测试要点**：
- 测试普通掷骰（无奖励/惩罚骰）
- 测试奖励骰逻辑（十位骰取较小值）
- 测试惩罚骰逻辑（十位骰取较大值）
- 测试特殊结果（大成功=01，大失败=100或<96且技能值<50）

#### 4.3.2 技能检定判定

**功能描述**：
- 根据技能值和掷骰结果判定成功等级
- 成功等级分为：大成功（critical）、极限成功（extreme，≤技能值/5）、困难成功（hard，≤技能值/2）、常规成功（regular，≤技能值）、失败（failure）、大失败（fumble，=100或≥96且技能值<50）

**核心函数**：
```typescript
function evaluateSuccess(rollTotal: number, skillValue: number): { level: SuccessLevel; rank: number }
function skillCheck(input: SkillCheckInput): SkillCheckResult
```

**测试要点**：
- 测试所有成功等级的分界点（技能值/5、技能值/2、技能值、01、100、96-99且技能值<50）
- 测试不同难度设置（regular、hard、extreme）的通过判定

#### 4.3.3 对抗检定

**功能描述**：
- 比较两个调查员的技能检定结果
- 优先比较成功等级排名（大成功 > 极限成功 > 困难成功 > 常规成功 > 失败 > 大失败）
- 如果成功等级相同，比较技能值
- 如果技能值也相同，比较掷骰总值（较小者胜）
- 如果掷骰总值也相同，则为平局

**核心函数**：
```typescript
function opposedCheck(input: { actor: SkillCheckResult; opponent: SkillCheckResult }): { winner: 'actor' | 'opponent' | 'tie'; reason: string }
```

**测试要点**：
- 测试不同成功等级的对抗
- 测试相同成功等级但不同技能值的对抗
- 测试相同成功等级和技能值但不同掷骰总值的对抗
- 测试完全相同结果的平局

#### 4.3.4 组合检定

**功能描述**：
- 多个技能依次检定
- 全部通过才算成功
- 返回失败的检定列表

**核心函数**：
```typescript
function combinedCheck(checks: SkillCheckResult[]): { passed: boolean; checks: SkillCheckResult[]; failedChecks: SkillCheckResult[] }
```

**测试要点**：
- 测试全部通过的情况
- 测试部分失败的情况
- 测试全部失败的情况

#### 4.3.5 SAN检定表达式解析

**功能描述**：
- 解析SAN损失表达式（如 `"0/1D6"`、`"1/1D10"`）
- 表达式格式为 `"成功损失/失败损失"`
- 支持d100、d10、d6等骰子表达式
- 支持固定数值（如 `"0"`、`"3"`）
- 支持修饰符（如 `"1D6+3"`）

**核心函数**：
```typescript
function parseSanLoss(expression: string): { success: DiceExpression; failure: DiceExpression }
```

**测试要点**：
- 测试标准表达式（`"0/1D6"`、`"1/1D10"`）
- 测试复杂表达式（`"1D6+2/2D10"`）
- 测试错误格式（缺少 `/` 分隔符）

#### 4.3.6 SAN损失处理

**功能描述**：
- 根据SAN检定结果计算理智损失
- 如果损失 ≥5，触发INT检定决定是否陷入临时疯狂
- 临时疯狂从疯狂发作表（INSANITY_BOUTS）随机抽取结果

**核心函数**：
```typescript
function resolveSanCheck(input: { currentSan: number; intValue: number; expression: string; sanRoll?: number; lossRolls?: number[]; intRoll?: number; boutRoll?: number }): SanEvent
```

**疯狂发作表（INSANITY_BOUTS）**：
```typescript
const INSANITY_BOUTS: InsanityBout[] = [
  { roll: 1, name: '失忆', description: '调查员忘记从上一处安全地点以来发生的事情，持续1D10轮。' },
  { roll: 2, name: '心身残疾', description: '调查员因心理冲击陷入失明、耳聋或肢体失能，持续1D10轮。' },
  { roll: 3, name: '暴力倾向', description: '调查员被狂怒攫住，对周遭目标失控施暴，持续1D10轮。' },
  { roll: 4, name: '偏执妄想', description: '调查员认定所有人都在背叛、窥视或欺骗自己，持续1D10轮。' },
  { roll: 5, name: '人际依赖', description: '调查员将场景中的某人误认为重要之人，持续1D10轮。' },
  { roll: 6, name: '昏厥', description: '调查员立即昏倒，并在1D10轮后苏醒。' },
  { roll: 7, name: '惊慌逃窜', description: '调查员用一切可行方式远离现场，持续1D10轮。' },
  { roll: 8, name: '歇斯底里', description: '调查员无法控制地哭泣、狂笑或尖叫，持续1D10轮。' },
  { roll: 9, name: '恐惧症', description: '调查员获得新的恐惧症，相关行动承受一枚惩罚骰，持续1D10轮。' },
  { roll: 10, name: '躁狂症', description: '调查员获得新的躁狂症，相关行动承受一枚惩罚骰，持续1D10轮。' }
];
```

**测试要点**：
- 测试SAN损失计算（成功损失 vs 失败损失）
- 测试临时疯狂触发（损失 ≥5 且INT检定失败）
- 测试疯狂发作表随机抽取
- 测试SAN值边界（不低于0）

#### 4.3.7 骰子表达式求值

**功能描述**：
- 求值骰子表达式（如 `"2D6+3"`）
- 支持多个骰子项（如 `"1D10+2D6"`）
- 支持正负数值修饰符

**核心函数**：
```typescript
function evaluateDiceExpression(expression: DiceExpression, forcedRolls: number[] = []): number
```

**测试要点**：
- 测试标准骰子表达式（`"2D6+3"`）
- 测试多个骰子项（`"1D10+2D6"`）
- 测试仅修饰符（`"5"`）
- 测试强制掷骰结果（用于测试固定场景）

**验收标准**：
- ✅ 所有核心规则函数已实现
- ✅ 规则引擎通过所有单元测试（`cocRules.test.ts`）
- ✅ 规则计算结果与COC 7e规则书一致

### 4.4 数据存储层实现

**描述**：在 `server/store.ts` 中实现基于SQL.js的持久化方案。

#### 4.4.1 技术选型

**SQL.js**：
- 在浏览器中运行的SQLite编译版本
- 数据存储在内存中，可导出为 `.db` 文件
- 无需独立数据库服务器，适合本机演示版

#### 4.4.2 数据表设计

**rooms 表**（房间）：
```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currentScene TEXT DEFAULT '',
  createdAt TEXT NOT NULL
);
```

**participants 表**（参与者）：
```sql
CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL REFERENCES rooms(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('keeper', 'player')),
  investigatorId TEXT REFERENCES investigators(id),
  joinedAt TEXT NOT NULL
);
```

**investigators 表**（调查员角色卡）：
```sql
CREATE TABLE investigators (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL REFERENCES rooms(id),
  ownerParticipantId TEXT REFERENCES participants(id),
  name TEXT NOT NULL,
  occupation TEXT NOT NULL,
  age INTEGER NOT NULL,
  attributes TEXT NOT NULL,  -- JSON string
  derived TEXT NOT NULL,    -- JSON string
  skills TEXT NOT NULL,     -- JSON string
  possessions TEXT NOT NULL, -- JSON string
  wounds TEXT NOT NULL,     -- JSON string
  conditions TEXT NOT NULL,  -- JSON string
  growthMarks TEXT NOT NULL -- JSON string
);
```

**messages 表**（消息）：
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  roomId TEXT NOT NULL REFERENCES rooms(id),
  senderId TEXT REFERENCES participants(id),
  senderName TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('system', 'player', 'keeper', 'ai', 'roll')),
  text TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK(visibility IN ('public', 'keeper', 'private')),
  metadata TEXT,  -- JSON string
  createdAt TEXT NOT NULL
);
```

**knowledge_chunks 表**（知识片段）：
```sql
CREATE TABLE knowledge_chunks (
  id TEXT PRIMARY KEY,
  sourceName TEXT NOT NULL,
  sourceType TEXT NOT NULL,
  index INTEGER NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
```

#### 4.4.3 核心操作

**房间操作**：
- `createRoom(name: string): Room`
- `listRooms(): Room[]`
- `getRoom(id: string): Room | undefined`
- `updateRoom(room: Room): void`

**参与者操作**：
- `joinRoom(roomId: string, name: string, role: 'keeper' | 'player'): Participant`
- `listParticipants(roomId: string): Participant[]`
- `getParticipant(id: string): Participant | undefined`

**调查员操作**：
- `upsertInvestigator(investigator: Investigator): void`
- `getInvestigator(id: string): Investigator | undefined`
- `listInvestigators(roomId: string): Investigator[]`

**消息操作**：
- `addMessage(message: Message): Message`
- `listMessages(roomId: string, limit: number): Message[]`

**知识片段操作**：
- `addKnowledge(chunks: KnowledgeChunk[]): void`
- `listKnowledge(limit: number): KnowledgeChunk[]`
- `searchKnowledge(query: string, limit: number): KnowledgeSearchResult[]`

**验收标准**：
- ✅ 所有数据表已创建
- ✅ 所有核心CRUD操作已实现
- ✅ 存储层通过所有单元测试（`store.test.ts`）
- ✅ 数据可正确持久化和检索

---

## 5. 非功能需求

### 5.1 代码质量

1. **TypeScript严格模式**：启用 `strict: true`，禁止隐式 `any` 类型
2. **代码注释**：所有核心函数和复杂逻辑必须有JSDoc注释
3. **命名规范**：变量、函数、类型命名必须清晰、一致、符合TypeScript命名约定

### 5.2 性能

1. **规则引擎性能**：单次掷骰或检定计算必须在 <1ms 内完成
2. **存储层性能**：单次CRUD操作必须在 <10ms 内完成（内存数据库）

### 5.3 可维护性

1. **模块分离**：规则引擎（`cocRules.ts`）和存储层（`store.ts`）必须独立，互不依赖
2. **类型共享**：前后端共享类型定义（`types.ts`），避免类型重复定义和不一致

---

## 6. 验收标准

### 6.1 交付物验收

1. ✅ **项目结构初始化完成**
   - 所有目录和配置文件已创建
   - `npm install` 可成功安装所有依赖
   - `npm run dev` 可成功启动开发服务器（即使功能尚未实现）

2. ✅ **核心数据类型定义完成**
   - `shared/types.ts` 包含所有核心类型定义
   - 类型定义通过TypeScript编译检查

3. ✅ **COC 7e规则引擎实现完成**
   - `shared/cocRules.ts` 包含所有核心规则函数
   - 规则引擎通过所有单元测试（`cocRules.test.ts`）
   - 测试覆盖率 ≥ 90%

4. ✅ **数据存储层实现完成**
   - `server/store.ts` 包含所有核心CRUD操作
   - 存储层通过所有单元测试（`store.test.ts`）
   - 测试覆盖率 ≥ 80%

### 6.2 质量验收

1. ✅ **TypeScript编译通过**
   - 无任何编译错误和警告（在 `strict` 模式下）

2. ✅ **代码注释完整**
   - 所有核心函数都有JSDoc注释
   - 复杂逻辑都有行内注释

3. ✅ **命名规范一致**
   - 变量、函数、类型命名符合TypeScript命名约定
   - 无拼写错误和含糊命名

---

## 7. 风险与依赖

### 7.1 风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| COC 7e规则理解有误 | 高 | 中 | 反复对照COC 7e规则书；编写详尽单元测试覆盖边界情况；邀请资深COC玩家进行规则审查 |
| TypeScript类型定义过于复杂 | 中 | 低 | 保持类型定义简洁；使用类型别名和接口继承减少重复；必要时使用 `type` 而非 `interface` |
| SQL.js性能不满足需求 | 低 | 低 | Phase 1 是内存数据库，性能通常不是问题；如果确实有问题，Phase 3 考虑优化或迁移到更强大的数据库 |

### 7.2 依赖

| 依赖 | 描述 | 负责人 |
|------|------|----------|
| Phase 0 深度研究报告 | Phase 1 的规则引擎实现必须遵循Phase 0 中定义的规则数据模型和系统提示词框架 | AI守秘人系统团队 |

---

## 8. 时间规划

### 8.1 预计工期

**2周**（2026-05-21 至 2026-06-03）

### 8.2 里程碑

| 里程碑 | 预计完成日期 | 实际完成日期 | 状态 |
|----------|--------------|--------------|------|
| 完成项目结构初始化 | 2026-05-22 | 2026-05-22 | ✅ 已完成 |
| 完成核心数据类型定义 | 2026-05-23 | 2026-05-23 | ✅ 已完成 |
| 完成COC 7e规则引擎实现 | 2026-05-28 | 2026-05-27 | ✅ 已完成 |
| 完成规则引擎单元测试 | 2026-05-30 | 2026-05-28 | ✅ 已完成 |
| 完成数据存储层实现 | 2026-06-01 | 2026-05-30 | ✅ 已完成 |
| 完成存储层单元测试 | 2026-06-03 | 2026-05-30 | ✅ 已完成 |

---

## 9. 附录

### 9.1 参考资料

1. COC 7e 核心规则书（Chaosium）
2. 海豹骰（sealdice）源码（`ext_coc7.go`）—— Go语言实现的COC 7e规则引擎，作为参考
3. SQL.js 官方文档（https://github.com/sql-js/sql.js）

### 9.2 术语表

| 术语 | 定义 |
|------|------|
| d100 | 百面骰，COC 7e的核心骰子 |
| 技能检定 | 调查员使用技能时的成功/失败判定 |
| SAN | Sanity（理智值），COC中的核心状态指标 |
| 奖励骰 | Bonus Die，额外掷一个十位骰，取较小值 |
| 惩罚骰 | Penalty Die，额外掷一个十位骰，取较大值 |
| 大成功 | Critical Success，掷出01 |
| 大失败 | Fumble，掷出100，或掷出96-99且技能值<50 |
| 极限成功 | Extreme Success，掷骰结果 ≤ 技能值/5 |
| 困难成功 | Hard Success，掷骰结果 ≤ 技能值/2 |
| 常规成功 | Regular Success，掷骰结果 ≤ 技能值 |
| 对抗检定 | Opposed Check，两个调查员进行技能对抗 |
| 组合检定 | Combined Check，多个技能依次检定，全部通过才算成功 |
| 临时疯狂 | Temporary Insanity，SAN单次损失 ≥5 且INT检定失败时触发 |
| SQL.js | 在浏览器中运行的SQLite编译版本 |

---

**变更日志**：

- 2026-05-27: 根据PHASE_TRACKER.md和实际完成情况更新状态为"已完成"
- 2026-05-21: 初始版本创建
