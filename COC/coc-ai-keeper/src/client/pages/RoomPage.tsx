import { Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { askKeeper, joinRoom, sendMessage } from '../api';
import { useRoomState } from '../hooks';
import { CharacterCard } from '../components/CharacterCard';
import { CharacterImportPanel } from '../components/CharacterImportPanel';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MessageFeed } from '../components/MessageFeed';
import type { Participant } from '../../shared/types';

export function RoomPage({ roomId }: { roomId: string }) {
  const { state, error } = useRoomState(roomId);
  const [name, setName] = useState('温特斯');
  const [participant, setParticipant] = useState<Participant | undefined>(() => loadParticipant(roomId));
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const investigator = useMemo(
    () => state.investigators.find((item) => item.id === participant?.investigatorId) ?? state.investigators[0],
    [state.investigators, participant]
  );

  async function handleJoin() {
    try {
      const joined = await joinRoom(roomId, name, 'player');
      setParticipant(joined);
      localStorage.setItem(`coc-player-${roomId}`, JSON.stringify(joined));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitAction() {
    if (!action.trim() || !participant) return;
    setBusy(true);
    setActionError('');
    const text = action.trim();
    setAction('');
    try {
      await sendMessage({ roomId, senderId: participant.id, senderName: participant.name, type: 'player', text });
      await askKeeper({ roomId, senderId: participant.id, action: text });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!participant) {
    return (
      <main className="app-frame join-frame">
        <section className="panel join-panel">
          <h1>加入调查</h1>
          <input value={name} onChange={(event) => setName(event.target.value)} aria-label="玩家昵称" />
          <button onClick={handleJoin}>进入房间</button>
          <a href={`/keeper/${roomId}`}>打开KP控制台</a>
          {error && <p className="error-text">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-frame table-layout">
      <header className="topbar">
        <div>
          <p className="eyebrow">Room {roomId.slice(0, 8)}</p>
          <h1>{state.room?.name ?? 'COC 调查'}</h1>
        </div>
        <nav>
          <a href={`/keeper/${roomId}`}>KP控制台</a>
          <a href="/library">资料库</a>
        </nav>
      </header>
      <section className="workspace">
        <aside className="side-stack">
          <CharacterImportPanel roomId={roomId} ownerParticipantId={participant.id} />
          {investigator && <CharacterCard investigator={investigator} />}
        </aside>
        <section className="panel play-panel">
          {error && <div className="error-banner">连接错误：{error}</div>}
          {actionError && <div className="error-banner">{actionError}</div>}
          <MessageFeed messages={state.messages} roomId={roomId} investigatorId={investigator?.id} viewerRole="player" viewerParticipantId={participant.id} />
          <div className="composer">
            <textarea value={action} onChange={(event) => setAction(event.target.value)} placeholder="声明调查员行动..." disabled={busy} />
            <button onClick={submitAction} disabled={busy || !action.trim()}>
              {busy ? <LoadingSpinner label="AI思考中..." /> : <><Send size={18} />发送行动</>}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function loadParticipant(roomId: string): Participant | undefined {
  try {
    const raw = localStorage.getItem(`coc-player-${roomId}`);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
