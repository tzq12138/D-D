import { describe, expect, it } from 'vitest';
import {
  combinedCheck,
  evaluateSuccess,
  opposedCheck,
  parseSanLoss,
  resolveSanCheck,
  rollD100,
  skillCheck
} from '../src/shared/cocRules';

describe('COC d100 rules', () => {
  it('uses the lower tens die for bonus dice and higher tens die for penalty dice', () => {
    expect(rollD100({ forced: { unit: 4, tens: [8, 2] }, bonusDice: 1 }).total).toBe(24);
    expect(rollD100({ forced: { unit: 4, tens: [8, 2] }, penaltyDice: 1 }).total).toBe(84);
  });

  it('handles multiple bonus dice by selecting the lowest tens digit', () => {
    const roll = rollD100({ forced: { unit: 7, tens: [9, 3, 1] }, bonusDice: 2 });
    expect(roll.total).toBe(17);
  });

  it('handles multiple penalty dice by selecting the highest tens digit', () => {
    const roll = rollD100({ forced: { unit: 2, tens: [1, 5, 8] }, penaltyDice: 2 });
    expect(roll.total).toBe(82);
  });

  it('treats 00+0 as 100 (fumble)', () => {
    expect(rollD100({ forced: { unit: 0, tens: [0] } }).total).toBe(100);
  });

  it('treats 00+5 as 5 (not 105)', () => {
    expect(rollD100({ forced: { unit: 5, tens: [0] } }).total).toBe(5);
  });

  it('classifies regular, hard, extreme, critical, and fumble outcomes', () => {
    expect(evaluateSuccess(1, 60).level).toBe('critical');
    expect(evaluateSuccess(12, 60).level).toBe('extreme');
    expect(evaluateSuccess(30, 60).level).toBe('hard');
    expect(evaluateSuccess(60, 60).level).toBe('regular');
    expect(evaluateSuccess(96, 40).level).toBe('fumble');
    expect(evaluateSuccess(100, 70).level).toBe('fumble');
  });

  it('does not fumble on 96-99 when skill is 50+', () => {
    expect(evaluateSuccess(96, 50).level).toBe('failure');
    expect(evaluateSuccess(99, 90).level).toBe('failure');
  });

  it('clamps skill value to 1-100 range', () => {
    expect(evaluateSuccess(1, 0).level).toBe('critical');
    expect(evaluateSuccess(50, 200).level).toBe('hard');
  });

  it('checks requested difficulty instead of treating every success as enough', () => {
    const hardPass = skillCheck({
      skillName: '图书馆使用',
      skillValue: 60,
      difficulty: 'hard',
      forced: { unit: 0, tens: [3] }
    });
    const extremeFail = skillCheck({
      skillName: '图书馆使用',
      skillValue: 60,
      difficulty: 'extreme',
      forced: { unit: 0, tens: [3] }
    });

    expect(hardPass.passed).toBe(true);
    expect(extremeFail.passed).toBe(false);
  });

  it('defaults to regular difficulty when not specified', () => {
    const result = skillCheck({ skillName: '侦查', skillValue: 50, forced: { unit: 0, tens: [4] } });
    expect(result.difficulty).toBe('regular');
    expect(result.passed).toBe(true);
  });

  it('resolves opposed checks by success level, then skill value, then lower roll', () => {
    expect(
      opposedCheck({
        actor: skillCheck({ skillName: '魅惑', skillValue: 55, forced: { unit: 5, tens: [4] } }),
        opponent: skillCheck({ skillName: '魅惑', skillValue: 65, forced: { unit: 1, tens: [5] } })
      }).winner
    ).toBe('opponent');

    expect(
      opposedCheck({
        actor: skillCheck({ skillName: '斗殴', skillValue: 60, forced: { unit: 0, tens: [2] } }),
        opponent: skillCheck({ skillName: '闪避', skillValue: 60, forced: { unit: 5, tens: [2] } })
      }).winner
    ).toBe('actor');
  });

  it('returns tie when both rolls are identical', () => {
    const result = opposedCheck({
      actor: skillCheck({ skillName: '斗殴', skillValue: 60, forced: { unit: 0, tens: [2] } }),
      opponent: skillCheck({ skillName: '闪避', skillValue: 60, forced: { unit: 0, tens: [2] } })
    });
    expect(result.winner).toBe('tie');
    expect(result.reason).toBe('same-result');
  });

  it('requires every component of a combined check to pass', () => {
    const result = combinedCheck([
      skillCheck({ skillName: '侦查', skillValue: 70, forced: { unit: 0, tens: [4] } }),
      skillCheck({ skillName: '聆听', skillValue: 40, forced: { unit: 5, tens: [8] } })
    ]);

    expect(result.passed).toBe(false);
    expect(result.failedChecks.map((check) => check.skillName)).toEqual(['聆听']);
  });

  it('passes combined check when all checks succeed', () => {
    const result = combinedCheck([
      skillCheck({ skillName: '侦查', skillValue: 70, forced: { unit: 0, tens: [4] } }),
      skillCheck({ skillName: '聆听', skillValue: 60, forced: { unit: 0, tens: [3] } })
    ]);
    expect(result.passed).toBe(true);
    expect(result.failedChecks).toHaveLength(0);
  });
});

describe('COC SAN rules', () => {
  it('parses fixed and dice SAN loss expressions', () => {
    expect(parseSanLoss('0/1D6')).toEqual({
      success: { dice: [], modifier: 0 },
      failure: { dice: [{ count: 1, sides: 6 }], modifier: 0 }
    });
    expect(parseSanLoss('1/1D10+1').failure.modifier).toBe(1);
  });

  it('parses complex SAN expressions like 1D6+2/2D10', () => {
    const result = parseSanLoss('1D6+2/2D10');
    expect(result.success.dice).toEqual([{ count: 1, sides: 6 }]);
    expect(result.success.modifier).toBe(2);
    expect(result.failure.dice).toEqual([{ count: 2, sides: 10 }]);
  });

  it('throws on invalid SAN expression format', () => {
    expect(() => parseSanLoss('invalid')).toThrow('Invalid SAN expression');
  });

  it('applies success loss when SAN check passes', () => {
    const event = resolveSanCheck({
      currentSan: 50,
      intValue: 60,
      expression: '1/1D6',
      sanRoll: 30,
      lossRolls: [4]
    });
    expect(event.success).toBe(true);
    expect(event.loss).toBe(1);
    expect(event.newSan).toBe(49);
  });

  it('applies failure loss when SAN check fails', () => {
    const event = resolveSanCheck({
      currentSan: 50,
      intValue: 60,
      expression: '0/1D6',
      sanRoll: 80,
      lossRolls: [4]
    });
    expect(event.success).toBe(false);
    expect(event.loss).toBe(4);
    expect(event.newSan).toBe(46);
  });

  it('clamps SAN to minimum 0', () => {
    const event = resolveSanCheck({
      currentSan: 3,
      intValue: 60,
      expression: '0/1D10',
      sanRoll: 80,
      lossRolls: [10]
    });
    expect(event.newSan).toBe(0);
  });

  it('does not trigger temporary insanity when loss < 5', () => {
    const event = resolveSanCheck({
      currentSan: 50,
      intValue: 60,
      expression: '0/1D4',
      sanRoll: 80,
      lossRolls: [3]
    });
    expect(event.temporaryInsanity).toBeUndefined();
  });

  it('triggers temporary insanity when a failed SAN loss is at least five and INT check succeeds', () => {
    const event = resolveSanCheck({
      currentSan: 47,
      intValue: 65,
      expression: '0/1D6',
      sanRoll: 82,
      lossRolls: [6],
      intRoll: 41,
      boutRoll: 4
    });

    expect(event.loss).toBe(6);
    expect(event.newSan).toBe(41);
    expect(event.temporaryInsanity?.active).toBe(true);
    expect(event.temporaryInsanity?.bout.name).toBe('偏执妄想');
  });

  it('does not trigger temporary insanity when INT check fails', () => {
    const event = resolveSanCheck({
      currentSan: 47,
      intValue: 40,
      expression: '0/1D6',
      sanRoll: 82,
      lossRolls: [6],
      intRoll: 80
    });
    expect(event.loss).toBe(6);
    expect(event.temporaryInsanity).toBeUndefined();
  });
});
