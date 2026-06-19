import { Save, Send } from 'lucide-react';
import { useState } from 'react';
import { askKeeper, joinRoom, updateInvestigator } from '../api';
import { CharacterCard } from '../components/CharacterCard';
import { CharacterImportPanel } from '../components/CharacterImportPanel';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MessageFeed } from '../components/MessageFeed';
import { useRoomState } from '../hooks';
import type { Investigator, Participant } from '../../shared/types';

export function KeeperPage({ roomId }: { roomId: string }) {
  const { state, error: roomError } = useRoomState(roomId);
  const [keeper, setKeeper] = useState<Participant | undefined>(() => loadKeeper(roomId));
  const [name, setName] = useState('Keeper');
  const [prompt, setPrompt] = useState('');
  const [selected, setSelected] = useState<Investigator | undefined>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  async function handleJoin() {
    try {
      const joined = await joinRoom(roomId, name, 'keeper');
      setKeeper(joined);
      localStorage.setItem(`coc-keeper-${roomId}`, JSON.stringify(joined));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitPrompt() {
    if (!prompt.trim()) return;
    setBusy(true);
    setActionError('');
    const text = prompt.trim();
    setPrompt('');
    try {
      await askKeeper({ roomId, senderId: keeper?.id, action: text });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setSaveStatus('');
    try {
      await updateInvestigator(selected);
      setSaveStatus('已保存');
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : String(err));
    }
  }

  if (!keeper) {
    return (
      <main className="app-frame join-frame">
        <section className="panel join-panel">
          <h1>KP控制台</h1>
          <input value={name} onChange={(event) => setName(event.target.value)} />
          <button onClick={handleJoin}>进入控制台</button>
        </section>
      </main>
    );
  }

  const editing = selected ?? state.investigators[0];

  return (
    <main className="app-frame table-layout">
      <header className="topbar">
        <div>
          <p className="eyebrow">Keeper console</p>
          <h1>{state.room?.name ?? 'COC 调查'}</h1>
        </div>
        <nav>
          <a href={`/room/${roomId}`}>玩家桌面</a>
          <a href="/library">资料库</a>
        </nav>
      </header>
      <section className="keeper-grid">
        <section className="panel play-panel">
          {roomError && <div className="error-banner">连接错误：{roomError}</div>}
          {actionError && <div className="error-banner">{actionError}</div>}
          <MessageFeed messages={state.messages} roomId={roomId} investigatorId={editing?.id} viewerRole="keeper" viewerParticipantId={keeper?.id} />
          <div className="composer">
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="给AI守秘人一条控制台指令或玩家行动..." disabled={busy} />
            <button onClick={submitPrompt} disabled={busy || !prompt.trim()}>
              {busy ? <LoadingSpinner label="AI思考中..." /> : <><Send size={18} />生成回应</>}
            </button>
          </div>
        </section>
        <aside className="keeper-side">
          <CharacterImportPanel roomId={roomId} ownerParticipantId={keeper.id} />
          <section className="panel">
            <h2>调查员状态</h2>
            <div className="stack">
              {state.investigators.map((investigator) => (
                <button className="list-button" key={investigator.id} onClick={() => setSelected(investigator)}>
                  {investigator.name} · SAN {investigator.derived.san.current}
                </button>
              ))}
            </div>
            {editing && (
              <div className="editor">
                <label>HP<input type="number" value={editing.derived.hp.current} onChange={(event) => setSelected(patchDerived(editing, 'hp', Number(event.target.value)))} /></label>
                <label>SAN<input type="number" value={editing.derived.san.current} onChange={(event) => setSelected(patchDerived(editing, 'san', Number(event.target.value)))} /></label>
                <button onClick={saveSelected}><Save size={18} />保存状态</button>
                {saveStatus && <p className="muted">{saveStatus}</p>}
              </div>
            )}
          </section>
          {editing && <CharacterCard investigator={editing} compact />}
        </aside>
      </section>
    </main>
  );
}

function patchDerived(investigator: Investigator, key: 'hp' | 'san', current: number): Investigator {
  return {
    ...investigator,
    derived: {
      ...investigator.derived,
      [key]: {
        ...investigator.derived[key],
        current
      }
    }
  };
}

function loadKeeper(roomId: string): Participant | undefined {
  try {
    const raw = localStorage.getItem(`coc-keeper-${roomId}`);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
