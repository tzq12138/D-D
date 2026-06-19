import { Brain, HeartPulse, Sparkles, UserRound } from 'lucide-react';
import type { Investigator } from '../../shared/types';

export function CharacterCard({ investigator, compact = false }: { investigator: Investigator; compact?: boolean }) {
  const topSkills = Object.entries(investigator.skills).slice(0, compact ? 4 : 8);

  return (
    <section className="panel character-card" aria-label={`${investigator.name}角色卡`}>
      <div className="panel-title">
        <UserRound size={18} />
        <div>
          <h2>{investigator.name}</h2>
          <p>{investigator.occupation} · {investigator.age}岁</p>
        </div>
      </div>
      <div className="stat-grid">
        <div><HeartPulse size={16} /> HP {investigator.derived.hp.current}/{investigator.derived.hp.max}</div>
        <div><Brain size={16} /> SAN {investigator.derived.san.current}/{investigator.derived.san.max}</div>
        <div><Sparkles size={16} /> 幸运 {investigator.derived.luck.current}/{investigator.derived.luck.max}</div>
        <div>MP {investigator.derived.mp.current}/{investigator.derived.mp.max}</div>
      </div>
      <div className="mini-grid">
        {Object.entries(investigator.attributes).map(([key, value]) => (
          <span key={key}>{key} {value}</span>
        ))}
      </div>
      <div className="skill-list">
        {topSkills.map(([skill, value]) => (
          <span key={skill}>{skill} {value}</span>
        ))}
      </div>
      {!compact && (
        <div className="note-lines">
          <p>物品：{investigator.possessions.join('、') || '无'}</p>
          <p>状态：{[...investigator.wounds, ...investigator.conditions].join('、') || '稳定'}</p>
        </div>
      )}
    </section>
  );
}
