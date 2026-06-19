import { FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';
import { importInvestigatorXlsx } from '../api';

export function CharacterImportPanel({
  roomId,
  ownerParticipantId
}: {
  roomId: string;
  ownerParticipantId?: string;
}) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setStatus('');
    try {
      const investigator = await importInvestigatorXlsx({ roomId, ownerParticipantId, file });
      setStatus(`已导入：${investigator.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel import-panel">
      <div className="panel-title">
        <FileSpreadsheet size={18} />
        <div>
          <h2>导入xlsx角色卡</h2>
          <p>支持 COC七版整合半自动角色卡 的“人物卡/简化卡”格式。</p>
        </div>
      </div>
      <label className="button secondary import-button">
        <Upload size={18} />
        {busy ? '导入中' : '选择xlsx文件'}
        <input type="file" accept=".xlsx,.xlsm" hidden disabled={busy} onChange={(event) => handleFile(event.target.files?.[0])} />
      </label>
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
