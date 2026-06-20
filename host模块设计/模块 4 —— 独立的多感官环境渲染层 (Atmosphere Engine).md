

## v1.1 修订说明：字段统一与音频解锁

本模块的协议字段统一采用 `HOST_PROTOCOL_CONTRACT.md` 中的 `AtmospherePayload`：

- BGM 字段使用 `trackId / fadeInMs / volume`，不再使用 `track / fade_in`。
- `shake.duration` 改为 `durationMs`。
- AI 不能直接“操纵声光电”。AI 只能请求氛围意图，Engine 根据场景权限和节奏广播 `s2c_atmosphere`。
- 浏览器音频需要用户手势解锁。Host 大屏必须有一个“启动主持台/进入房间”的首次点击，初始化 Howler AudioContext 后才能播放 BGM。

如果说前面的状态机和渲染队列是骨架，那么环境渲染层就是这个跑团发车台的**血肉与灵魂**。跑团时的恐怖感、压迫感，很大程度上取决于这套系统能把光影和声效调度到什么程度。

它的核心挑战是：**它必须悬浮在所有 UI 之上，且不能阻挡玩家的任何点击操作；同时，音乐的切换必须像电影剪辑一样丝滑。**

我们把它分为两部分来实现：**视觉覆盖层 (Visual Overlay)** 和 **独立音频混音器 (Audio Mixer)**。

### 第一部分：状态树的扩展 (Atmosphere State)

我们继续在 `useHostStore.ts` 中增加环境相关的状态。这些状态由 Python 引擎通过 `s2c_atmosphere` 指令直接修改。

TypeScript

```
// src/client/host/store/useHostStore.ts

interface AtmosphereState {
  visual: {
    filter?: 'deep_red' | 'cold_blue' | 'sepia' | 'darkness';
    vignette?: number; // 暗角强度 0.0 - 1.0
    shake?: { intensity: 'low'|'medium'|'high'; durationMs: number }; // 屏幕震动
    glitch?: boolean;  // 故障/撕裂特效
  };
  bgm: {
    trackId: string | null;
    volume: number;
    fadeInMs: number;
  };
  sfxQueue: { clipId: string; volume?: number }[]; // 等待播放的音效队列
}

// 在 Zustand 的 set 方法中：
setAtmosphere: (payload: AtmospherePayload) => set((state) => {
  const newState = { ...state };

  if (payload.visual) {
    newState.visual = { ...state.visual, ...payload.visual };
  }

  if (payload.bgm) {
    newState.bgm = payload.bgm;
  }

  if (payload.sfx) {
    newState.sfxQueue = [...state.sfxQueue, ...payload.sfx];
  }

  return newState;
})
```

### 第二部分：视觉覆盖层 (`AtmosphereOverlay.tsx`)

这是挂载在大屏幕最顶层的一个绝对定位的 `div`。最关键的 CSS 属性是 `pointer-events: none;`，这样鼠标点击可以穿透它，点击到底层的按钮。

TypeScript

```
// src/client/host/components/AtmosphereOverlay.tsx
import React, { useEffect, useState } from 'react';
import { useHostStore } from '../store/useHostStore';
import './AtmosphereOverlay.css'; // 里面存放了关键帧动画

export function AtmosphereOverlay() {
  const visual = useHostStore(state => state.visual);
  const [isShaking, setIsShaking] = useState(false);

  // 处理一次性震动逻辑
  useEffect(() => {
    if (visual.shake) {
      setIsShaking(true);
      const timer = setTimeout(() => {
        setIsShaking(false);
      }, visual.shake.durationMs);
      return () => clearTimeout(timer);
    }
  }, [visual.shake]);

  // 动态组装 CSS 类名
  const classNames = [
    'atmosphere-overlay',
    visual.filter ? `filter-${visual.filter}` : '',
    visual.glitch ? 'glitch-effect' : '',
    isShaking && visual.shake ? `shake-${visual.shake.intensity}` : ''
  ].filter(Boolean).join(' ');

  // 用内联样式处理平滑渐变的暗角 (Vignette)
  const vignetteStyle = visual.vignette
    ? { background: `radial-gradient(circle, transparent 30%, rgba(0,0,0, ${visual.vignette}) 100%)` }
    : {};

  return (
    <div
      className={classNames}
      style={vignetteStyle}
      aria-hidden="true" // 告诉屏幕阅读器忽略此层
    >
      {/* 如果有雪花屏故障特效，可以在这里渲染一些噪点 div */}
      {visual.glitch && <div className="noise-layer" />}
    </div>
  );
}
```

**关键的 CSS 魔法 (`AtmosphereOverlay.css`)：**

CSS

```
/* 基础图层设置：全屏、置顶、穿透 */
.atmosphere-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none; /* 极其关键！ */
  z-index: 9999;
  transition: all 2s ease-in-out; /* 任何滤镜的切换都会有2秒的平滑过渡 */
}

/* 滤镜效果 (使用 mix-blend-mode 实现高级色彩混合) */
.filter-deep_red {
  background-color: rgba(150, 0, 0, 0.2);
  mix-blend-mode: multiply;
}

.filter-cold_blue {
  background-color: rgba(0, 50, 100, 0.15);
  mix-blend-mode: overlay;
}

/* 屏幕震动动画 */
@keyframes shakeHigh {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  10%, 30%, 50%, 70%, 90% { transform: translate(-10px, -5px) rotate(-2deg); }
  20%, 40%, 60%, 80% { transform: translate(10px, 5px) rotate(2deg); }
}

.shake-high {
  animation: shakeHigh 0.1s infinite;
}

/* 恐怖游戏标配：CRT 显示器故障/撕裂感 */
@keyframes glitch {
  0% { transform: translate(0) }
  20% { transform: translate(-2px, 2px) }
  40% { transform: translate(-2px, -2px) }
  60% { transform: translate(2px, 2px) }
  80% { transform: translate(2px, -2px) }
  100% { transform: translate(0) }
}
.glitch-effect {
  animation: glitch 0.2s cubic-bezier(.25, .46, .45, .94) both infinite;
  background-image: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px);
}
```

### 第三部分：独立音频混音器 (`AudioMixer.ts`)

绝对不要用 HTML 的 `<audio>` 标签来做跑团发车台！由于浏览器的限制，原生的 audio 很难实现多轨并行和丝滑的淡入淡出（Crossfade）。

我们需要引入强大的音频库 `Howler.js`。我们将它封装成一个**不依赖于 React 渲染周期的单例管理器**。

TypeScript

```
// src/client/host/audio/AudioMixer.ts
import { Howl, Howler } from 'howler';

// 本地音频资产映射表
const AUDIO_ASSETS = {
  bgm: {
    'investigation': '/assets/audio/bgm_investigation.mp3',
    'combat': '/assets/audio/bgm_combat_chase.mp3',
    'madness': '/assets/audio/bgm_insanity.mp3',
  },
  sfx: {
    'heartbeat': '/assets/audio/sfx_heartbeat_fast.mp3',
    'bone_snap': '/assets/audio/sfx_bone_snap.mp3',
    'monster_roar': '/assets/audio/sfx_roar.mp3',
  }
};

export class AudioMixer {
  private static instance: AudioMixer;
  private currentBgm: Howl | null = null;
  private currentTrackId: string | null = null;

  private constructor() {
    // 初始化全局音量设置
    Howler.volume(1.0);
  }

  public unlockByUserGesture() {
    if (Howler.ctx?.state === 'suspended') {
      Howler.ctx.resume();
    }
  }

  public static getInstance(): AudioMixer {
    if (!AudioMixer.instance) {
      AudioMixer.instance = new AudioMixer();
    }
    return AudioMixer.instance;
  }

  // 播放背景音乐 (支持淡入淡出切换)
  public playBGM(trackId: string, volume = 0.5, fadeInMs = 2000) {
    if (this.currentTrackId === trackId) return; // 已经在播了

    const nextSrc = AUDIO_ASSETS.bgm[trackId as keyof typeof AUDIO_ASSETS.bgm];
    if (!nextSrc) {
      console.warn(`未找到 BGM 资源: ${trackId}`);
      return;
    }

    const nextBgm = new Howl({ src: [nextSrc], loop: true, volume: 0 });

    // 如果当前有歌在播，先将其淡出
    if (this.currentBgm) {
      const oldBgm = this.currentBgm;
      oldBgm.fade(oldBgm.volume(), 0, fadeInMs);
      oldBgm.once('fade', () => {
        oldBgm.unload(); // 彻底销毁，释放内存
      });
    }

    // 播放新歌并淡入
    nextBgm.play();
    nextBgm.fade(0, volume, fadeInMs);

    this.currentBgm = nextBgm;
    this.currentTrackId = trackId;
  }

  // 播放一次性音效 (支持多轨叠加)
  public playSFX(clipId: string, volume = 0.8) {
    const src = AUDIO_ASSETS.sfx[clipId as keyof typeof AUDIO_ASSETS.sfx];
    if (!src) return;

    const sfx = new Howl({ src: [src], volume });
    sfx.play();

    // 播放完毕自动销毁
    sfx.on('end', () => sfx.unload());
  }
}
```

最后，在 React 中写一个隐形的控制器 Hook 来桥接 Store 和 AudioMixer：

TypeScript

```
// src/client/host/hooks/useAudioController.ts
import { useEffect } from 'react';
import { useHostStore } from '../store/useHostStore';
import { AudioMixer } from '../audio/AudioMixer';

export function useAudioController() {
  const bgmState = useHostStore(state => state.bgm);
  const sfxQueue = useHostStore(state => state.sfxQueue);
  const shiftSfx = useHostStore(state => state.shiftSfx); // 假设你在 store 里加了这个方法

  // 监听 BGM 变化
  useEffect(() => {
    if (bgmState.trackId) {
      AudioMixer.getInstance().playBGM(bgmState.trackId, bgmState.volume, bgmState.fadeInMs);
    }
  }, [bgmState]);

  // 处理音效队列
  useEffect(() => {
    if (sfxQueue.length > 0) {
      const clip = sfxQueue[0];
      AudioMixer.getInstance().playSFX(clip.clipId, clip.volume);
      shiftSfx(); // 播完移出队列
    }
  }, [sfxQueue]);
}
```

### 模块 4 小结

将这个 `<AtmosphereOverlay>` 组件和 `useAudioController` Hook 挂载到大屏幕的根节点之后，Python 引擎就正式获得了操纵“光影与声效”的无上权力。

你可以设想这样一个转场： AI 请求 `request_scene_transition("地下室")` -> Python 引擎校验场景锁并广播 `{ bgm: { trackId: 'combat', fadeInMs: 2000, volume: 0.5 }, visual: { vignette: 0.8, filter: 'cold_blue' } }`。 在短短 2 秒钟内，屏幕四周被浓重的黑影吞噬，画面蒙上一层阴冷的蓝光，原来的悬疑音乐逐渐消失，取而代之的是急促的鼓点。所有的玩家都会不自觉地坐直身子。
