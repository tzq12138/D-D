export type Difficulty = 'regular' | 'hard' | 'extreme';
export type SuccessLevel = 'critical' | 'extreme' | 'hard' | 'regular' | 'failure' | 'fumble';
export type Visibility = 'public' | 'keeper' | 'private';

export interface Room {
  id: string;
  name: string;
  currentScene: string;
  createdAt: string;
}

export interface Participant {
  id: string;
  roomId: string;
  name: string;
  role: 'keeper' | 'player';
  investigatorId?: string;
  joinedAt: string;
}

export interface Investigator {
  id: string;
  roomId: string;
  ownerParticipantId?: string;
  name: string;
  occupation: string;
  age: number;
  attributes: Record<string, number>;
  derived: {
    hp: { current: number; max: number };
    san: { current: number; max: number };
    luck: { current: number; max: number };
    mp: { current: number; max: number };
    move: number;
    damageBonus: string;
    build: number;
  };
  skills: Record<string, number>;
  possessions: string[];
  wounds: string[];
  conditions: string[];
  growthMarks: string[];
}

export interface DiceTerm {
  count: number;
  sides: number;
}

export interface DiceExpression {
  dice: DiceTerm[];
  modifier: number;
}

export interface RollRequest {
  id: string;
  type: 'skill' | 'opposed' | 'combined' | 'san';
  label: string;
  skillName?: string;
  suggestedSkills?: string[];
  skillValue?: number;
  difficulty?: Difficulty;
  bonusDice?: number;
  penaltyDice?: number;
  sanExpression?: string;
  reason: string;
  visibility: Visibility;
}

export interface D100Roll {
  total: number;
  unit: number;
  tens: number[];
  selectedTens: number;
  bonusDice: number;
  penaltyDice: number;
}

export interface SkillCheckResult {
  type: 'skill';
  skillName: string;
  skillValue: number;
  difficulty: Difficulty;
  roll: D100Roll;
  level: SuccessLevel;
  passed: boolean;
}

export interface SanEvent {
  expression: string;
  sanRoll: number;
  success: boolean;
  loss: number;
  oldSan: number;
  newSan: number;
  temporaryInsanity?: {
    active: boolean;
    intRoll: number;
    bout: InsanityBout;
  };
}

export interface InsanityBout {
  roll: number;
  name: string;
  description: string;
}

export interface KnowledgeChunk {
  id: string;
  sourceName: string;
  sourceType: string;
  index: number;
  text: string;
  createdAt: string;
}

export interface KnowledgeSearchResult {
  chunk: KnowledgeChunk;
  score: number;
}

export interface KeeperResponse {
  narrative: string;
  rollRequest?: RollRequest;
  stateSuggestions: string[];
  keeperNotes: string;
  sources: Array<{
    sourceName: string;
    excerpt: string;
  }>;
}

export interface Message {
  id: string;
  roomId: string;
  senderId?: string;
  senderName: string;
  type: 'system' | 'player' | 'keeper' | 'ai' | 'roll';
  text: string;
  visibility: Visibility;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
