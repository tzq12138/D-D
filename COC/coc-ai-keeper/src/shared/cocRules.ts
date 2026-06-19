import type {
  D100Roll,
  DiceExpression,
  Difficulty,
  InsanityBout,
  SanEvent,
  SkillCheckResult,
  SuccessLevel
} from './types';

type ForcedD100 = {
  unit: number;
  tens: number[];
};

export interface D100Options {
  bonusDice?: number;
  penaltyDice?: number;
  forced?: ForcedD100;
}

export interface SkillCheckInput extends D100Options {
  skillName: string;
  skillValue: number;
  difficulty?: Difficulty;
}

const SUCCESS_RANK: Record<SuccessLevel, number> = {
  fumble: 0,
  failure: 1,
  regular: 2,
  hard: 3,
  extreme: 4,
  critical: 5
};

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  regular: SUCCESS_RANK.regular,
  hard: SUCCESS_RANK.hard,
  extreme: SUCCESS_RANK.extreme
};

export const INSANITY_BOUTS: InsanityBout[] = [
  { roll: 1, name: '失忆', description: '调查员忘记从上一处安全地点以来发生的事情，持续1D10轮。' },
  { roll: 2, name: '心身残疾', description: '调查员因心理冲击陷入失明、耳聋或肢体失能，持续1D10轮。' },
  { roll: 3, name: '暴力倾向', description: '调查员被狂怒攫住，对周遭目标失控施暴，持续1D10轮。' },
  { roll: 4, name: '偏执妄想', description: '调查员认定所有人都在背叛、窥视或欺骗自己，持续1D10轮。' },
  { roll: 5, name: '人际依赖', description: '调查员将场景中的某人误认为重要之人，持续1D10轮。' },
  { roll: 6, name: '昏厥', description: '调查员立即昏倒，并在1D10轮后苏醒。' },
  { roll: 7, name: '惊慌逃窜', description: '调查员用一切可行方式远离现场，持续1D10轮。' },
  { roll: 8, name: '歇斯底里', description: '调查员无法控制地哭泣、狂笑或尖叫，持续1D10轮。' },
  { roll: 9, name: '恐惧症', description: '调查员获得新的恐惧症，相关行动承受一枚惩罚骰，持续1D10轮。' },
  { roll: 10, name: '躁狂症', description: '调查员获得新的躁狂症，相关行动承受一枚惩罚骰，持续1D10轮。' }
];

export function rollD100(options: D100Options = {}): D100Roll {
  const bonusDice = Math.max(0, options.bonusDice ?? 0);
  const penaltyDice = Math.max(0, options.penaltyDice ?? 0);
  const extraDice = Math.max(bonusDice, penaltyDice);
  const unit = clampDigit(options.forced?.unit ?? randomDigit());
  const tens = normalizeTens(options.forced?.tens, extraDice + 1);
  const activeMode = bonusDice > penaltyDice ? 'bonus' : penaltyDice > bonusDice ? 'penalty' : 'normal';
  const selectedTens = activeMode === 'bonus' ? Math.min(...tens) : activeMode === 'penalty' ? Math.max(...tens) : tens[0];
  const total = selectedTens === 0 && unit === 0 ? 100 : selectedTens * 10 + unit;

  return { total, unit, tens, selectedTens, bonusDice, penaltyDice };
}

export function evaluateSuccess(rollTotal: number, skillValue: number): { level: SuccessLevel; rank: number } {
  const normalizedSkill = clampPercent(skillValue);
  const roll = clampPercent(rollTotal);

  let level: SuccessLevel;
  if (roll === 1) {
    level = 'critical';
  } else if ((normalizedSkill < 50 && roll >= 96) || roll === 100) {
    level = 'fumble';
  } else if (roll <= Math.floor(normalizedSkill / 5)) {
    level = 'extreme';
  } else if (roll <= Math.floor(normalizedSkill / 2)) {
    level = 'hard';
  } else if (roll <= normalizedSkill) {
    level = 'regular';
  } else {
    level = 'failure';
  }

  return { level, rank: SUCCESS_RANK[level] };
}

export function skillCheck(input: SkillCheckInput): SkillCheckResult {
  const difficulty = input.difficulty ?? 'regular';
  const roll = rollD100(input);
  const outcome = evaluateSuccess(roll.total, input.skillValue);
  const passed = outcome.rank >= DIFFICULTY_RANK[difficulty];

  return {
    type: 'skill',
    skillName: input.skillName,
    skillValue: input.skillValue,
    difficulty,
    roll,
    level: outcome.level,
    passed
  };
}

export function opposedCheck(input: {
  actor: SkillCheckResult;
  opponent: SkillCheckResult;
}): { winner: 'actor' | 'opponent' | 'tie'; reason: string } {
  const actorRank = SUCCESS_RANK[input.actor.level];
  const opponentRank = SUCCESS_RANK[input.opponent.level];
  if (actorRank !== opponentRank) {
    return actorRank > opponentRank
      ? { winner: 'actor', reason: 'success-level' }
      : { winner: 'opponent', reason: 'success-level' };
  }
  if (input.actor.skillValue !== input.opponent.skillValue) {
    return input.actor.skillValue > input.opponent.skillValue
      ? { winner: 'actor', reason: 'skill-value' }
      : { winner: 'opponent', reason: 'skill-value' };
  }
  if (input.actor.roll.total !== input.opponent.roll.total) {
    return input.actor.roll.total < input.opponent.roll.total
      ? { winner: 'actor', reason: 'lower-roll' }
      : { winner: 'opponent', reason: 'lower-roll' };
  }
  return { winner: 'tie', reason: 'same-result' };
}

export function combinedCheck(checks: SkillCheckResult[]): {
  passed: boolean;
  checks: SkillCheckResult[];
  failedChecks: SkillCheckResult[];
} {
  const failedChecks = checks.filter((check) => !check.passed);
  return { passed: failedChecks.length === 0, checks, failedChecks };
}

export function parseSanLoss(expression: string): { success: DiceExpression; failure: DiceExpression } {
  const parts = expression.toUpperCase().replace(/\s+/g, '').split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid SAN expression: ${expression}`);
  }
  return {
    success: parseDiceExpression(parts[0]),
    failure: parseDiceExpression(parts[1])
  };
}

export function resolveSanCheck(input: {
  currentSan: number;
  intValue: number;
  expression: string;
  sanRoll?: number;
  lossRolls?: number[];
  intRoll?: number;
  boutRoll?: number;
}): SanEvent {
  const sanRoll = input.sanRoll ?? rollD100().total;
  const success = sanRoll <= input.currentSan;
  const parsed = parseSanLoss(input.expression);
  const loss = evaluateDiceExpression(success ? parsed.success : parsed.failure, input.lossRolls);
  const newSan = Math.max(0, input.currentSan - loss);
  const event: SanEvent = {
    expression: input.expression,
    sanRoll,
    success,
    loss,
    oldSan: input.currentSan,
    newSan
  };

  if (loss >= 5) {
    const intRoll = input.intRoll ?? rollD100().total;
    if (intRoll <= input.intValue) {
      const boutRoll = clampBout(input.boutRoll ?? randomBetween(1, 10));
      event.temporaryInsanity = {
        active: true,
        intRoll,
        bout: INSANITY_BOUTS[boutRoll - 1]
      };
    }
  }

  return event;
}

function parseDiceExpression(raw: string): DiceExpression {
  if (!raw) return { dice: [], modifier: 0 };
  const normalized = raw.replace(/-/g, '+-');
  const parts = normalized.split('+').filter(Boolean);
  const expression: DiceExpression = { dice: [], modifier: 0 };

  for (const part of parts) {
    const diceMatch = /^(\d*)D(\d+)$/.exec(part);
    if (diceMatch) {
      expression.dice.push({
        count: Number(diceMatch[1] || 1),
        sides: Number(diceMatch[2])
      });
    } else {
      const value = Number(part);
      if (Number.isNaN(value)) throw new Error(`Invalid dice term: ${part}`);
      expression.modifier += value;
    }
  }

  return expression;
}

function evaluateDiceExpression(expression: DiceExpression, forcedRolls: number[] = []): number {
  let forcedIndex = 0;
  let total = expression.modifier;
  for (const term of expression.dice) {
    for (let i = 0; i < term.count; i += 1) {
      const forced = forcedRolls[forcedIndex++];
      total += forced ?? randomBetween(1, term.sides);
    }
  }
  return Math.max(0, total);
}

function normalizeTens(forcedTens: number[] | undefined, count: number): number[] {
  const values = forcedTens?.length ? [...forcedTens] : [];
  while (values.length < count) values.push(randomDigit());
  return values.slice(0, count).map(clampDigit);
}

function randomDigit(): number {
  return Math.floor(Math.random() * 10);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampDigit(value: number): number {
  return Math.min(9, Math.max(0, Math.floor(value)));
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(1, Math.floor(value)));
}

function clampBout(value: number): number {
  return Math.min(10, Math.max(1, Math.floor(value)));
}
