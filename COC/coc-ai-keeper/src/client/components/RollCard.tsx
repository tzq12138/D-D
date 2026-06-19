import { Dice5 } from 'lucide-react';
import { useState } from 'react';
import { runRoll } from '../api';
import type { RollRequest } from '../../shared/types';

export function RollCard({
  roomId,
  investigatorId,
  request,
  alreadyRolled = false
}: {
  roomId: string;
  investigatorId?: string;
  request: RollRequest;
  alreadyRolled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyRolled);

  async function handleRoll() {
    setBusy(true);
    try {
      await runRoll({ roomId, investigatorId, request });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="roll-card">
      <div>
        <strong>{request.label}</strong>
        <p>{request.skillName ?? request.suggestedSkills?.join(' / ')} · {request.difficulty ?? 'regular'} · {request.reason}</p>
      </div>
      <button className="icon-button" onClick={handleRoll} disabled={busy || done || alreadyRolled} title="执行检定">
        <Dice5 size={18} />
        {done || alreadyRolled ? '已检定' : busy ? '检定中' : '掷骰'}
      </button>
    </div>
  );
}
