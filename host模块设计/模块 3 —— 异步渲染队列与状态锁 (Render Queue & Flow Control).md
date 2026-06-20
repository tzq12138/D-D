
## v1.1 修订说明：从 boolean 锁升级为事务锁

本模块的核心原则保留，但实现必须从 `isUIBusy: boolean` 升级为可恢复的事务锁：

- 队列元素优先处理 `s2c_reveal_transaction`，事务内部按 `roll -> status_delta -> narrative_stream` 等步骤顺序释放。
- 锁必须包含 `lockToken`、`reason`、`deadline`。只有持有同一个 token 的演出组件可以解锁。
- 如果动画、音频或 3D 初始化失败，watchdog 必须在 deadline 后降级解锁并显示错误，不能让 Host 永久卡死。
- 流式文本必须按 `streamId + seq` 聚合，不能追加到“最后一条消息”。

如果说前面的模块是“数据的搬运工”，那这个模块就是“舞台的场记”。它的核心任务只有一个：**严格控制时间线，绝不能让 AI 的嘴比骰子跑得快。**

为了实现这个机制，我们需要在 React 中写一个精密的“齿轮系统”。

### 第一部分：状态树的扩展 (Queue & Lock State)

回到我们的 `useHostStore.ts`，我们需要为它增加三个核心属性：**待处理队列 (Queue)**、**当前锁状态 (Lock)**、以及**当前的演出剧本 (Current Scene)**。

TypeScript

```
// src/client/host/store/useHostStore.ts
import { create } from 'zustand';
import { ServerMessage } from '../network/types';

interface HostState {
  // ... 之前的 players 状态 ...

  // 1. 渲染队列与状态锁
  eventQueue: ServerMessage[];
  activeLock: null | { token: string; reason: string; deadline: number };

  // 2. 当前正在舞台上播放的动作
  currentRollEvent: any | null;
  chatStreams: Record<string, { role: string; speakerName?: string; text: string; nextSeq: number; isFinal: boolean }>;

  // 3. 队列操作方法
  enqueueRenderEvent: (msg: ServerMessage) => void;
  shiftEvent: () => void;
  acquireLock: (token: string, reason: string, timeoutMs: number) => void;
  releaseLock: (token: string) => void;

  // 4. 演出操作方法
  appendChatStream: (streamId: string, seq: number, chunk: string, isFinal: boolean) => void;
  triggerRollAnimation: (rollPayload: any) => void;
  clearRollAnimation: () => void;
}

export const useHostStore = create<HostState>((set) => ({
  // ... players 初始值 ...

  eventQueue: [],
  activeLock: null,
  currentRollEvent: null,
  chatStreams: {
    sys: { role: 'system', text: '守秘人已就绪...', nextSeq: 0, isFinal: true }
  },

  // 新消息入队（EventRouter 收到消息就无脑塞进这里）
  enqueueRenderEvent: (msg) => set((state) => ({
    eventQueue: [...state.eventQueue, msg]
  })),

  // 弹出队首消息
  shiftEvent: () => set((state) => ({
    eventQueue: state.eventQueue.slice(1)
  })),

  // 控制舞台锁
  acquireLock: (token, reason, timeoutMs) => set({
    activeLock: { token, reason, deadline: Date.now() + timeoutMs }
  }),
  releaseLock: (token) => set((state) => (
    state.activeLock?.token === token ? { activeLock: null } : state
  )),

  // 追加文本到最后一条消息
  appendChatStream: (streamId, seq, chunk, isFinal) => set((state) => {
    const current = state.chatStreams[streamId] ?? { role: 'keeper', text: '', nextSeq: 0, isFinal: false };
    if (seq !== current.nextSeq) return state;
    return {
      chatStreams: {
        ...state.chatStreams,
        [streamId]: {
          ...current,
          text: current.text + chunk,
          nextSeq: seq + 1,
          isFinal
        }
      }
    };
  }),

  // 触发骰子
  triggerRollAnimation: (payload) => set({ currentRollEvent: payload }),
  clearRollAnimation: () => set({ currentRollEvent: null })
}));
```

### 第二部分：无情的“事件泵” (`useQueueProcessor.ts`)

我们需要写一个自定义 Hook，它就像一个永不疲倦的水泵。只要水管没被事务锁堵住（`activeLock === null`），它就把队列里的消息抽出来执行。

TypeScript

```
// src/client/host/hooks/useQueueProcessor.ts
import { useEffect } from 'react';
import { useHostStore } from '../store/useHostStore';

export function useQueueProcessor() {
  const {
    eventQueue,
    activeLock,
    acquireLock,
    shiftEvent,
    appendChatStream,
    triggerRollAnimation
  } = useHostStore();

  useEffect(() => {
    // 1. 如果队列为空，或者当前舞台被锁住了，直接挂起，什么都不做！
    if (eventQueue.length === 0 || activeLock) return;

    // 2. 取出队首的事件
    const currentEvent = eventQueue[0];

    // 3. 根据事件类型决定是否上锁
    switch (currentEvent.type) {
      case 's2c_reveal_transaction':
        acquireLock(currentEvent.payload.lockToken, 'reveal_transaction', 10000);
        // 真实实现中交给事务播放器逐 step 执行；这里只强调它不能被拆散抢跑。
        shiftEvent();
        break;

      case 's2c_chat_stream':
        // 纯文本流，不需要阻塞后续动画，直接上屏，弹出队列
        appendChatStream(
          currentEvent.payload.streamId,
          currentEvent.payload.seq,
          currentEvent.payload.chunk,
          currentEvent.payload.isFinal
        );
        shiftEvent();
        break;

      case 's2c_roll_event':
        // 🚨 遇到掷骰子！立刻给舞台上锁！
        acquireLock(currentEvent.payload.lockToken, 'roll_animation', 10000);
        triggerRollAnimation(currentEvent.payload);
        shiftEvent(); // 移出队列，把控制权交给骰子组件
        break;

      // 其他可能阻塞视觉的指令（如切大背景、播放惊悚全屏特效）
      // case 's2c_scene_transition':
      //   acquireLock(token, 'scene_transition', 10000); ...
    }

  }, [eventQueue, activeLock]); // 依赖这两者，任何一个变化都会触发重新检查
}
```

### 第三部分：舞台总控与“解铃人” (`StageRenderer.tsx`)

现在，队列和锁都有了，那么谁来开锁？ 答案是：**正在播放动画的那个组件自己。**

让我们来看看大屏幕中央的舞台组件是怎么把这一切串起来的。

TypeScript

```
// src/client/host/components/StageRenderer.tsx
import React, { useEffect } from 'react';
import { useHostStore } from '../store/useHostStore';
import { useQueueProcessor } from '../hooks/useQueueProcessor';

// 这是一个极其简化的 3D 骰子组件示意
function Dice3DViewer({ rollEvent, onAnimationComplete }) {
  useEffect(() => {
    if (!rollEvent) return;

    console.log("🎲 开始播放 3D 骰子滚动动画...");

    // 模拟 3D 动画耗时（3秒）
    const timer = setTimeout(() => {
      console.log(`🎲 骰子停在了: ${rollEvent.rolled_value} (${rollEvent.label})`);

      // 动画播完，额外停顿 1 秒让玩家看清结果，然后再呼叫回调
      setTimeout(() => {
        onAnimationComplete();
      }, 1000);

    }, 3000);

    return () => clearTimeout(timer);
  }, [rollEvent]);

  if (!rollEvent) return null;
  return (
    <div className="dice-canvas-overlay">
       {/* 实际项目中这里是 Three.js 的 <Canvas> */}
       <div className="fake-dice">正在滚动... {rollEvent.rolled_value}</div>
    </div>
  );
}

export function StageRenderer() {
  // 启动无情的事件泵
  useQueueProcessor();

  const chatStreams = useHostStore(state => state.chatStreams);
  const currentRollEvent = useHostStore(state => state.currentRollEvent);
  const releaseLock = useHostStore(state => state.releaseLock);
  const clearRollAnimation = useHostStore(state => state.clearRollAnimation);

  return (
    <div className="stage-renderer">
      {/* 1. KP 的字幕输出区 */}
      <div className="kp-subtitle-area">
        {Object.entries(chatStreams).map(([id, stream]) => (
          <div key={id} className="subtitle-line">{stream.text}</div>
        ))}
      </div>

      {/* 2. 阻塞式的动画层 */}
      {currentRollEvent && (
        <Dice3DViewer
          rollEvent={currentRollEvent}
          onAnimationComplete={() => {
            // 🚨 核心：动画播完，清理舞台，并且【解开 UI 锁】！
            clearRollAnimation();
            releaseLock(currentRollEvent.lockToken); // 锁一解开，useQueueProcessor 会瞬间把积压的文本推出来
          }}
        />
      )}
    </div>
  );
}
```

### 体验闭环：这 4 秒钟内发生了什么？

想象一下底层的网络中发生了什么，以及玩家究竟看到了什么：

1. **`0.0s` 网络闪电战**：玩家说“我开枪”。0.1秒后，Python 引擎算出`s2c_roll_event`（95，大失败），并立刻让 AI 生成描述。AI 以极快的速度输出了 10 个 `s2c_chat_stream` 文本块（“你的枪炸膛了，手指被炸飞……”）。

2. **`0.1s` 前端堆积**：这 11 条消息瞬间全部涌入前端的 `eventQueue`。

3. **`0.2s` 事件泵启动，遇锁**：`useQueueProcessor` 读取第一条消息（掷骰子），立刻调用 `acquireLock(lockToken, 'roll_animation')`，召唤出 3D 骰子组件。

4. **`0.2s - 3.2s` 死亡宁静**：3D 骰子在大屏幕中央疯狂翻滚。虽然此时 `eventQueue` 里塞满了 AI 绝望的剧透描述，但因为 `activeLock` 存在，事件泵死死地卡住了。大屏幕的字幕区一片死寂。

5. **`3.2s` 判决**：骰子定格在 95，屏幕闪红。玩家开始尖叫。

6. **`4.2s` 解锁倾泻**：骰子组件停顿一秒后，调用 `onAnimationComplete` -> `releaseLock(lockToken)`。

7. **`4.21s` 字幕涌出**：事件泵瞬间复苏，把憋在队列里的 10 条文本如同水库泄洪一样倾泻到屏幕的字幕区上。


**完美！毫无破绽的演出！** 这就如同电影导演一样，你在前端用几十行代码死死地控制住了整个剧本的节奏感。

现在，大屏幕的“通信底座”、“监视器”、“渲染队列场记”都已经完成了。只剩下最后的“声光电特效组”和“舞美组”了。
