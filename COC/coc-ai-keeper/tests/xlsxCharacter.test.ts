import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseInvestigatorXlsx } from '../src/server/xlsxCharacter';

const samplePath = path.resolve('..', 'tzq12138.xlsx');

describe('COC integrated xlsx character sheet parser', () => {
  it('imports the fixed 人物卡/简化卡 format used by tzq12138.xlsx', async () => {
    const investigator = await parseInvestigatorXlsx(samplePath, {
      roomId: 'room-1',
      ownerParticipantId: 'player-1'
    });

    expect(investigator.name).toBe('阿尔伯特·格雷');
    expect(investigator.occupation).toBe('罪犯-独行罪犯');
    expect(investigator.age).toBe(26);
    expect(investigator.attributes).toMatchObject({
      STR: 65,
      CON: 25,
      SIZ: 80,
      DEX: 35,
      APP: 40,
      INT: 80,
      POW: 55,
      EDU: 40
    });
    expect(investigator.derived).toMatchObject({
      hp: { current: 10, max: 10 },
      san: { current: 55, max: 99 },
      luck: { current: 60, max: 60 },
      mp: { current: 11, max: 11 },
      move: 7,
      damageBonus: '+1D4',
      build: 1
    });
    expect(investigator.skills).toMatchObject({
      '图书馆使用': 20,
      '聆听': 45,
      '锁匠': 14,
      '技艺：表演': 80,
      '技艺：乐理': 50,
      '格斗：斗殴': 25,
      '射击：手枪': 20,
      '侦查': 25,
      '潜行': 38
    });
    expect(investigator.wounds).toEqual([]);
    expect(investigator.conditions).toEqual([]);
  });
});
