
## v1.1 修订说明：HUD 不能抢先剧透

HUD 是公共演出的一部分，不是后台数据库监控器。它可以实时反映状态，但必须尊重防剧透事务：

- 初始进入房间、重连校准、非剧情后台同步可以使用 `s2c_status_sync` 直接更新。
- 掷骰、伤害、SAN、线索发现、暗骰等会影响玩家预期的变化，必须作为 `s2c_reveal_transaction.steps[].status_delta` 进入队列。
- `PlayerCard` 的受伤动画应由事务释放时触发，而不是由 WebSocket 到达时间触发。

在 Host 端（大屏幕终端）上，HUD（平视显示器）就像是整个跑团桌的“仪表盘”。它需要实时反映所有玩家的生命体征。当某个玩家在自己的手机上触发了陷阱掉血时，大屏幕上的仪表盘必须在对应演出步骤释放后做出抢眼的视觉反馈，让全桌人倒吸一口凉气。

为了实现这个目标，我们需要在上一节的 `useHostStore` 中定义一棵“多实体状态树”，并配合 React 编写具有生命力的组件。

以下是模块 2 的核心代码拆解：

### 第一部分：状态树设计 (`useHostStore.ts`)

在 Zustand 中，我们不光要存玩家的当前血量，还要存一些“瞬时状态”（比如刚才扣了多少血），这样前端组件才知道该不该播“闪红出血”的动画。

TypeScript

```
// src/client/host/store/useHostStore.ts
import { create } from 'zustand';
import { ServerMessage, AtmospherePayload } from '../network/types';

// 定义单个玩家的节点状态
export interface PlayerNode {
  id: string;
  name: string;
  avatarUrl: string;
  hp: { current: number; max: number };
  san: { current: number; max: number };
  statusTags: string[]; // 例如: ['疯狂', '重伤']

  // 用于触发 UI 动画的瞬时状态
  lastHpDelta: number;
  isTakingDamage: boolean;
}

interface HostState {
  // 1. 玩家数据字典 (用 Record 方便 O(1) 查找和更新)
  players: Record<string, PlayerNode>;

  // 2. 更新玩家状态的方法 (供 EventRouter 调用)
  updatePlayerStatus: (characterId: string, updates: Partial<PlayerNode>) => void;

  // ... 其他状态 (环境、队列等)
}

export const useHostStore = create<HostState>((set) => ({
  players: {
    // 初始状态可以先硬编码或者从房间初始化接口拉取
    'player_1': {
      id: 'player_1', name: '诺贝尔', avatarUrl: '/assets/avatar1.png',
      hp: { current: 10, max: 10 }, san: { current: 50, max: 50 },
      statusTags: [], lastHpDelta: 0, isTakingDamage: false
    },
    // ... 其他玩家
  },

  updatePlayerStatus: (characterId, updates) => set((state) => {
    const player = state.players[characterId];
    if (!player) return state;

    // 计算是否在掉血，用于触发动画
    let takingDamage = false;
    let hpDelta = 0;
    if (updates.hp && updates.hp.current < player.hp.current) {
      takingDamage = true;
      hpDelta = updates.hp.current - player.hp.current; // 负数
    }

    return {
      players: {
        ...state.players,
        [characterId]: {
          ...player,
          ...updates,
          lastHpDelta: hpDelta,
          isTakingDamage: takingDamage,
        }
      }
    };
  }),
}));
```

### 第二部分：全局监视器布局 (`GlobalHUD.tsx`)

HUD 通常悬浮在大屏幕的顶部边缘。我们把 `players` 字典遍历出来，为每个玩家渲染一张独立的角色卡片。

TypeScript

```
// src/client/host/components/GlobalHUD.tsx
import React from 'react';
import { useHostStore } from '../store/useHostStore';
import { PlayerCard } from './PlayerCard';
import './GlobalHUD.css';

export function GlobalHUD() {
  const players = useHostStore(state => state.players);

  return (
    <div className="global-hud-container">
      {Object.values(players).map(player => (
        <PlayerCard key={player.id} player={player} />
      ))}
    </div>
  );
}
```

### 第三部分：“活体”角色卡组件 (`PlayerCard.tsx`)

这是这个模块的灵魂。我们要利用刚才存入的 `isTakingDamage` 状态，结合 CSS 动画，让静态的数字变成具有疼痛感的视觉反馈。

_(提示：这里如果配合 `framer-motion` 动画库效果会极佳，这里用原生 React + CSS 演示思路)_

TypeScript

```
// src/client/host/components/PlayerCard.tsx
import React, { useEffect, useState } from 'react';
import { PlayerNode, useHostStore } from '../store/useHostStore';

export function PlayerCard({ player }: { player: PlayerNode }) {
  const [showDamageNumber, setShowDamageNumber] = useState(false);

  // 监听受伤状态，触发震动和飘字动画
  useEffect(() => {
    if (player.isTakingDamage) {
      setShowDamageNumber(true);
      // 动画播完后重置状态
      const timer = setTimeout(() => setShowDamageNumber(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [player.isTakingDamage]);

  // 计算血条和理智条的百分比
  const hpPercent = (player.hp.current / player.hp.max) * 100;
  const sanPercent = (player.san.current / player.san.max) * 100;

  // 如果血量低于 30%，边框持续闪烁红光警告
  const isDying = hpPercent <= 30;

  return (
    <div className={`player-card ${player.isTakingDamage ? 'shake-animation' : ''} ${isDying ? 'critical-border' : ''}`}>
      <img src={player.avatarUrl} alt={player.name} className="avatar" />

      <div className="stats-area">
        <div className="player-name">{player.name}</div>

        {/* HP 条 */}
        <div className="stat-bar-container">
          <span className="stat-label">HP</span>
          <div className="bar-bg">
            <div className="bar-fill hp-fill" style={{ width: `${hpPercent}%` }} />
          </div>
          <span className="stat-value">{player.hp.current}/{player.hp.max}</span>
        </div>

        {/* SAN 条 */}
        <div className="stat-bar-container">
          <span className="stat-label">SAN</span>
          <div className="bar-bg">
            <div className="bar-fill san-fill" style={{ width: `${sanPercent}%` }} />
          </div>
          <span className="stat-value">{player.san.current}</span>
        </div>

        {/* 异常状态标签 */}
        <div className="tags-area">
          {player.statusTags.map(tag => (
             <span key={tag} className="status-tag">{tag}</span>
          ))}
        </div>
      </div>

      {/* 受伤飘字动画层 (绝对定位悬浮在头像上) */}
      {showDamageNumber && (
        <div className="damage-floating-text">
          {player.lastHpDelta}
        </div>
      )}
    </div>
  );
}
```

### 对应的精美 CSS 动画 (`GlobalHUD.css`)

CSS

```
/* 剧烈的受伤震动 */
@keyframes shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-4px) rotate(-1deg); }
  50% { transform: translateX(4px) rotate(1deg); }
  75% { transform: translateX(-4px) rotate(-1deg); }
  100% { transform: translateX(0); }
}
.shake-animation {
  animation: shake 0.3s ease-in-out;
  border-color: #ff0000;
  background-color: rgba(255, 0, 0, 0.2); /* 卡片整体泛红 */
}

/* 濒死心跳闪烁 */
@keyframes pulseRed {
  0% { box-shadow: 0 0 0px 0px rgba(255, 0, 0, 0.7); }
  50% { box-shadow: 0 0 15px 5px rgba(255, 0, 0, 0.5); }
  100% { box-shadow: 0 0 0px 0px rgba(255, 0, 0, 0.7); }
}
.critical-border {
  animation: pulseRed 1s infinite;
}

/* 飘字动画（血红色的 "-3" 向上飘并淡出） */
@keyframes floatUp {
  0% { opacity: 1; transform: translateY(0) scale(1.5); }
  100% { opacity: 0; transform: translateY(-40px) scale(1); }
}
.damage-floating-text {
  position: absolute;
  top: -10px;
  right: 10px;
  color: #ff3333;
  font-weight: 900;
  font-size: 24px;
  text-shadow: 0 0 5px black;
  animation: floatUp 1.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
  pointer-events: none;
}
```

### 模块 2 小结

至此，大屏幕的“生命体征监视器”已经运转起来了。

你可以想象一下数据流的走向：

1. 某玩家过了一个大失败，Python 引擎创建 `s2c_reveal_transaction`，其中先包含 `roll` 步骤，再包含 `status_delta({"character_id": "player_1", "hp": {"before": 10, "after": 7, "max": 10}})`。

2. 模块 1 的 `EventRouter` 收到事务后压入渲染队列，等待骰子动画完成。

3. 队列处理器释放 `status_delta` 步骤时，调用 `store.updatePlayerStatus()`，Zustand 计算出 `isTakingDamage = true` 和 `lastHpDelta = -3`。

4. React 响应式渲染，`PlayerCard` 触发 CSS 的 `shake` 震动，同时屏幕上冒出一个血淋淋的 `-3`，然后血条平滑地减少。


这一切，大屏幕前的所有玩家都能同时看到，这就是电子发车台带来的压迫感！

目前大屏幕已经有了“通信底座（模块 1）”**和**“实时监视器（模块 2）”。
