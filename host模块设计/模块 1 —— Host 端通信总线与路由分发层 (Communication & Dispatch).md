
## v1.1 修订说明：通信层先校验，再分发

本模块代码骨架需要与 `HOST_PROTOCOL_CONTRACT.md` 对齐。Host 端通信层的首要职责不是“收到就分发”，而是：

1. 校验事件信封、`roomId`、`sequence` 和 payload schema。
2. 维护连接生命周期：同一房间只允许一个活跃 socket；换房间必须断开旧连接；重连使用退避和 `lastSequence` 补发。
3. 区分普通同步和防剧透事务。由检定、伤害、暗骰、线索发现导致的 `status_delta` 必须包含在 `s2c_reveal_transaction` 中，不能通过 `s2c_status_sync` 直接刷新 HUD。

在 Host 端（大屏幕），由于不需要处理玩家打字输入，它的核心使命就是“稳定地听”**和**“准确地分发”。如果把前端比作一个公司，这个模块就是前台的“收发室”。

为了保证代码的高内聚、低耦合，我们在 TypeScript/React 中通常会用**单例模式 (Singleton) + 全局状态管理 (Zustand)** 来实现它。

下面是这个模块的详细拆解和核心代码骨架：

### 第一部分：工程目录结构规划

在你的 React 项目中，为 Host 端建立一个独立的通信模块目录：

Plaintext

```
src/client/host/
  ├── network/
  │    ├── types.ts          // 强类型接口定义（协议字典）
  │    ├── HostWSClient.ts   // WebSocket 核心连接与重连机制（单例）
  │    └── EventRouter.ts    // 路由器：把 WS 消息转化为对 Store 的修改
  ├── store/
  │    └── useHostStore.ts   // 全局状态管理
```

### 第二部分：定义强类型接口 (`types.ts`)

TypeScript 的精髓在于类型体操。我们必须把 Python 后端可能发过来的所有指令格式定义死，这样后续开发时编辑器才会有完美的代码提示。

TypeScript

```
// src/client/host/network/types.ts

// 1. 定义所有可能的服务端指令枚举
export type ServerEventAction =
  | 's2c_reveal_transaction'
  | 's2c_chat_stream'
  | 's2c_roll_event'
  | 's2c_atmosphere'
  | 's2c_status_sync'
  | 's2c_engine_state';

// 2. 定义标准的消息信封
export interface ServerMessage<T = any> {
  eventId: string;
  roomId: string;
  type: ServerEventAction;
  issuedAt: number;
  sequence: number;
  payload: T;
}

// 3. 具体 Payload 定义（这里与我们之前设计的 JSON 对应）
export interface RollEventPayload {
  character_id: string;
  skill_name: string;
  dice_type: string;
  rolled_value: number;
  target_value: number;
  result_type: 'critical_success' | 'extreme_success' | 'hard_success' | 'regular_success' | 'failure' | 'fumble';
  label: string;
}

export interface AtmospherePayload {
  bgm?: { trackId: string | null; fadeInMs: number; volume: number };
  visual?: { filter?: string; vignette?: number; shake?: { intensity: string; durationMs: number }; glitch?: boolean };
}
```

### 第三部分：稳定的 WebSocket 引擎 (`HostWSClient.ts`)

在 React 18+ 的严格模式下，如果直接在 `useEffect` 里 `new WebSocket()` 很容易导致连接被反复创建和销毁。最好的做法是将其封装成一个**独立于 React 组件生命周期的纯 TypeScript 单例类**，并加入断线重连机制。

TypeScript

```
// src/client/host/network/HostWSClient.ts
import { routeServerMessage } from './EventRouter';
import { useHostStore } from '../store/useHostStore';

export class HostWSClient {
  private static instance: HostWSClient;
  private ws: WebSocket | null = null;
  private roomId: string;
  private reconnectTimer: any = null;

  private constructor(roomId: string) {
    this.roomId = roomId;
  }

  // 单例模式获取实例
  public static getInstance(roomId: string): HostWSClient {
    if (!HostWSClient.instance || HostWSClient.instance.roomId !== roomId) {
      HostWSClient.instance?.disconnect();
      HostWSClient.instance = new HostWSClient(roomId);
    }
    return HostWSClient.instance;
  }

  public connect() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    // 建立连接，URL 中带上 role=host 参数供 Python 引擎识别
    const baseUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws';
    const lastSequence = useHostStore.getState().lastSequence ?? 0;
    const wsUrl = `${baseUrl}?room=${this.roomId}&role=host&lastSequence=${lastSequence}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Host] 🟢 WebSocket 连接成功, 房间:', this.roomId);
      if (this.reconnectTimer) clearInterval(this.reconnectTimer);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // 核心：收到消息后，一律丢给路由器处理！
        routeServerMessage(message);
      } catch (err) {
        console.error('[Host] 消息解析失败:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[Host] 🔴 WebSocket 断开，5秒后尝试重连...');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
```

### 第四部分：核心路由器 (`EventRouter.ts`)

这是通信总线和 React 组件之间的“防火墙”。它接收到原生 JSON 后，根据不同的 `type`，去调用 Zustand Store 里的对应方法。 这完美区分了哪些动作需要**直接渲染**（如环境特效），哪些动作需要**排队**（如大失败描述）。

TypeScript

```
// src/client/host/network/EventRouter.ts
import { ServerMessage } from './types';
import { useHostStore } from '../store/useHostStore'; // 你的全局状态树

export function routeServerMessage(msg: ServerMessage) {
  // 直接操作 Zustand 状态，脱离 React 生命周期限制
  const store = useHostStore.getState();

  if (msg.roomId !== store.roomId || msg.sequence <= store.lastSequence) return;
  store.markSequence(msg.sequence);

  switch (msg.type) {
    // 0. 防剧透事务：骰子、状态变化、叙事流必须作为整体排队
    case 's2c_reveal_transaction':
      store.enqueueRenderEvent(msg);
      break;

    // 1. 视觉/听觉环境指令：无需排队，即刻生效
    case 's2c_atmosphere':
      store.setAtmosphere(msg.payload);
      break;

    // 2. 引擎状态提示：无需排队，更新右上角监视器
    case 's2c_engine_state':
      store.setEngineState(msg.payload.state);
      break;

    // 3. 非剧透全局快照：仅用于初始化或后台校准
    case 's2c_status_sync':
      store.updatePlayerStatus(msg.payload.character_id, msg.payload.updates);
      break;

    // 🚨 4. 掷骰子动画 & 文本渲染：极易剧透！必须压入渲染队列！
    case 's2c_roll_event':
    case 's2c_chat_stream':
      store.enqueueRenderEvent(msg);
      break;

    default:
      console.warn(`[Host] 收到未知的指令类型: ${msg.type}`);
  }
}
```

### 第五部分：在 React 根节点挂载

最后，我们只需要在 Host 端的根组件（如 `HostApp.tsx`）中挂载这个通信服务，整个大屏幕就开始运转了。

TypeScript

```
// src/client/host/HostApp.tsx
import React, { useEffect } from 'react';
import { HostWSClient } from './network/HostWSClient';
import { AtmosphereOverlay } from './components/AtmosphereOverlay';
import { GlobalHUD } from './components/GlobalHUD';
import { StageRenderer } from './components/StageRenderer'; // 处理队列的组件

export function HostApp({ roomId }) {

  useEffect(() => {
    // 组件挂载时，启动通信总线
    const wsClient = HostWSClient.getInstance(roomId);
    wsClient.connect();

    // 清理函数（可选，大屏通常不销毁）
  }, [roomId]);

  return (
    <div className="host-screen-container">
      {/* 视觉特效层放在最底下 */}
      <AtmosphereOverlay />

      {/* 全局玩家监视器 */}
      <GlobalHUD />

      {/* 核心的剧本演出区 (聊天、骰子掉落) */}
      <StageRenderer />
    </div>
  );
}
```

### 模块 1 小结

至此，“收发室”已经搭建完毕。这套代码极其清爽，React 组件里完全看不到丑陋的 `onmessage` 解析逻辑。

当 Python 后端发出指令时，数据流向是：**Python Engine -> WS 端口 -> `HostWSClient` -> `EventRouter` 拆包 -> 修改 `useHostStore` -> 触发 React UI 刷新**。

这就是方向 1（通信总线与路由分发）的全部工程骨架。
