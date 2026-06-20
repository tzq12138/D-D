

## v1.1 修订说明：演出回放，不参与判定

本模块负责把 Engine 已确认的事件演成戏，但不参与判定：

- 3D 骰子只回放 `RollEventPayload.rolledValue`，不能再生成或改写结果。
- 文本流必须按 `streamId + seq` 聚合，打字机只负责平滑展示已释放的文本。
- 场景背景切换应由 `s2c_scene_sync` 或事务中的 `scene_transition` 驱动，不能由 AI 文本里隐含的地点名推断。

如果说前面的模块搭建了“生命监视器”和“声光电特效”，那么这个模块就是真正用来“讲故事”的物理载体。它包含了剧本的视觉背景、AI 守秘人的台词字幕，以及决定生死的 3D 骰子。

这部分的难点在于如何把冰冷的数据流，转化为具有电影般质感的平滑演出。我们从以下三个核心组件来拆解：

### 第一部分：动态布景系统 (`SceneBackground.tsx`)

随着玩家在不同地点之间移动（比如从“图书馆”移动到“地下室”），大屏幕的背景图需要平滑切换。简单的 `<img>` 标签直接换 `src` 会导致画面闪烁，严重破坏沉浸感。

我们需要使用“双图层交叉淡入淡出 (Cross-fade)”的技术：

TypeScript

```
// src/client/host/components/Stage/SceneBackground.tsx
import React, { useEffect, useState } from 'react';
import { useHostStore } from '../../store/useHostStore';
import './Stage.css';

export function SceneBackground() {
  const currentImageUrl = useHostStore(state => state.currentSceneImageUrl);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (!currentImageUrl) return;

    // 每次场景切换，把新图推入数组，保留旧图做过渡
    setImages(prev => {
      const next = [...prev, currentImageUrl];
      // 保持数组里最多只有两张图（旧图和新图）
      return next.length > 2 ? next.slice(-2) : next;
    });
  }, [currentImageUrl]);

  return (
    <div className="scene-background-container">
      {images.map((url, index) => (
        <div
          key={url + index}
          className="bg-layer"
          style={{
            backgroundImage: `url(${url})`,
            // 如果是最后一张（最新加入的），就执行淡入动画；否则保持透明度 1 或慢慢淡出
            animation: index === images.length - 1 ? 'fadeIn 3s ease forwards' : 'fadeOut 3s ease forwards'
          }}
        />
      ))}
      {/* 可以在这里叠加一层极其微弱的动态雾气/粒子特效层 */}
      <div className="fog-overlay" />
    </div>
  );
}
```

### 第二部分：拟真打字机字幕引擎 (`TypewriterStream.tsx`)

这是一个非常容易被忽视的前端细节。大模型通过 WebSocket 发送 `s2c_chat_stream` 时，网络包是**不均匀**的（可能一下发来 5 个字，然后卡 0.5 秒，再发来 3 个字）。如果前端直接接收就上屏，文字看起来会一跳一跳的。

我们要写一个**本地文字缓冲池**，以固定的速度（比如每秒 20 个字）从缓冲池里“抽”字打印，配上微弱的敲击音效，这就是极致的打字机质感。

TypeScript

```
// src/client/host/components/Stage/TypewriterStream.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useHostStore } from '../../store/useHostStore';
import { AudioMixer } from '../../audio/AudioMixer';

export function TypewriterStream() {
  const chatStreams = useHostStore(state => state.chatStreams); // 这里存的是所有已释放且按 streamId 聚合的文本

  const [displayedText, setDisplayedText] = useState('');
  const targetText = Object.values(chatStreams).map(m => m.text).join(''); // 目标终点文本

  const tickRef = useRef<any>(null);

  useEffect(() => {
    // 如果显示的字数追上了目标字数，停止打印
    if (displayedText.length >= targetText.length) {
      clearInterval(tickRef.current);
      return;
    }

    // 否则，开启一个平滑的定时器，每次吐出一个字
    tickRef.current = setInterval(() => {
      setDisplayedText(prev => {
        const nextChar = targetText.charAt(prev.length);

        // 播放非常轻微的打字/滴答音效
        if (nextChar !== ' ') {
          AudioMixer.getInstance().playSFX('typewriter_tick', 0.1);
        }

        return prev + nextChar;
      });
    }, 50); // 每 50 毫秒打印一个字

    return () => clearInterval(tickRef.current);
  }, [targetText, displayedText]);

  return (
    <div className="subtitle-container">
      <div className="subtitle-text">
        {displayedText}
        {/* 光标闪烁 */}
        <span className="cursor-blink">_</span>
      </div>
    </div>
  );
}
```

### 第三部分：3D 骰子物理引擎 (`DiceCanvas.tsx`)

当最激动人心的 `s2c_roll_event` 触发时，我们需要在屏幕正中央下起“骰子雨”。 不要自己用纯 CSS 去写 3D 骰子，直接引入极其成熟的 React 3D 库：`react-three-fiber` + `use-cannon`（物理引擎），或者直接使用专门为 TRPG 优化的开源库 `@3d-dice/dice-box`。

以下是封装的伪代码思路（与我们在模块 3 中的事件泵对接）：

TypeScript

```
// src/client/host/components/Stage/DiceCanvas.tsx
import React, { useEffect } from 'react';
import DiceBox from '@3d-dice/dice-box'; // 假设使用第三方骰子库
import { useHostStore } from '../../store/useHostStore';

let diceBoxInstance: any = null;

export function DiceCanvas() {
  const currentRollEvent = useHostStore(state => state.currentRollEvent);
  const releaseLock = useHostStore(state => state.releaseLock);
  const clearRollAnimation = useHostStore(state => state.clearRollAnimation);

  // 初始化 3D 场景
  useEffect(() => {
    diceBoxInstance = new DiceBox("#dice-container", {
      assetPath: '/assets/dice-themes/', // 骰子材质贴图
      theme: 'cthulhu-bone',             // 克苏鲁骨头风格
      scale: 8                           // 在大屏上放大骰子
    });
    diceBoxInstance.init();
  }, []);

  // 监听引擎传来的掷骰事件
  useEffect(() => {
    if (currentRollEvent && diceBoxInstance) {
      console.log("🎲 物理引擎启动，投掷: ", currentRollEvent.dice_type);

      // 注意：Engine 的 rolled_value 才是真实结果。3D 骰子只是演出回放，不参与判定。
      diceBoxInstance.roll(currentRollEvent.dice_type, {
        themeColor: currentRollEvent.result_type === 'fumble' ? '#ff0000' : '#ffffff'
      }).then((results) => {

        // 骰子完全停稳了！
        // 1. 展示“大失败/大成功”的文字印花特效
        showResultBanner(currentRollEvent.label);

        // 2. 停顿 1.5 秒让全桌玩家看清惨烈的数值
        setTimeout(() => {
          // 3. 清理 3D 舞台，解开系统锁！打字机引擎将在此刻瞬间激活，喷涌而出！
          diceBoxInstance.clear();
          clearRollAnimation();
          releaseLock(currentRollEvent.lockToken);
        }, 1500);
      });
    }
  }, [currentRollEvent]);

  return <div id="dice-container" className="absolute-fullscreen" style={{ pointerEvents: 'none' }} />;
}
```

### Host 端大屏幕：全剧终 🎉

至此，**Host 端（大屏幕控制中心）的 5 大模块已经全部拆解完毕。** 如果把这 5 个模块拼合在一起，跑团时的实际运转画面是这样的：

1. **底层（SceneBackground）**：大屏幕背景是雷雨交加的印斯茅斯旅馆。

2. **第二层（DiceCanvas）**：随时准备掉落物理骰子。

3. **第三层（GlobalHUD）**：屏幕顶部悬浮着所有朋友的动态血条，随时准备闪红。

4. **第四层（TypewriterStream）**：底部悬浮着电影质感的字幕打字机。

5. **最顶层（AtmosphereOverlay）**：时刻准备接受系统指令，把整个屏幕变成血红色并剧烈震动。
