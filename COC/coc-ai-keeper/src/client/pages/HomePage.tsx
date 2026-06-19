import { BookOpen, DoorOpen } from 'lucide-react';
import { useState } from 'react';
import { createRoom } from '../api';

export function HomePage() {
  const [roomName, setRoomName] = useState('阿卡姆调查');
  const [joinId, setJoinId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const room = await createRoom(roomName);
      window.location.href = `/room/${room.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-frame home-frame">
      <section className="home-panel">
        <p className="eyebrow">Local web demo · COC 7th helper</p>
        <h1>COC AI Keeper</h1>
        <p className="lede">一个本机多人演示桌面：AI推进故事，软件负责检定、SAN、角色状态和资料检索。</p>
        <div className="form-row">
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} aria-label="房间名称" />
          <button onClick={handleCreate} disabled={busy}>
            <DoorOpen size={18} />
            创建调查房间
          </button>
        </div>
        <div className="form-row">
          <input value={joinId} onChange={(event) => setJoinId(event.target.value)} placeholder="已有房间ID" aria-label="已有房间ID" />
          <a className="button secondary" href={joinId ? `/room/${joinId}` : '/'}>加入房间</a>
        </div>
        <nav className="home-links">
          <a href="/library"><BookOpen size={18} />资料库</a>
        </nav>
        {error && <p className="error-text">{error}</p>}
      </section>
    </main>
  );
}
