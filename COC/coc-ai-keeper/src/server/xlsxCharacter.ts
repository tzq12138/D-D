import ExcelJS from 'exceljs';
import type { Investigator } from '../shared/types';

export interface ParseInvestigatorXlsxOptions {
  roomId: string;
  ownerParticipantId?: string;
  id?: string;
}

const LEFT_SKILL = {
  flag: 'B',
  name: 'F',
  specialty: 'H',
  value: 'R'
};

const RIGHT_SKILL = {
  flag: 'X',
  name: 'AB',
  specialty: 'AD',
  value: 'AN'
};

export async function parseInvestigatorXlsx(filePath: string, options: ParseInvestigatorXlsxOptions): Promise<Investigator> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return parseInvestigatorWorkbook(workbook, options);
}

export function parseInvestigatorWorkbook(workbook: ExcelJS.Workbook, options: ParseInvestigatorXlsxOptions): Investigator {
  const sheet = requireSheet(workbook, '人物卡');
  const compact = workbook.getWorksheet('简化卡');
  const name = text(sheet, 'E3') || '未命名调查员';
  const occupation = text(sheet, 'E5') || '调查员';
  const age = number(sheet, 'E6', 30);
  const luck = number(sheet, 'AG7', number(compact, 'I9', 50));
  const skills = parseSkills(sheet);

  return {
    id: options.id ?? crypto.randomUUID(),
    roomId: options.roomId,
    ownerParticipantId: options.ownerParticipantId,
    name,
    occupation,
    age,
    attributes: {
      STR: number(sheet, 'U3', 50),
      CON: number(sheet, 'U5', 50),
      SIZ: number(sheet, 'U7', 50),
      DEX: number(sheet, 'AA3', 50),
      APP: number(sheet, 'AA5', 50),
      INT: number(sheet, 'AA7', 50),
      POW: number(sheet, 'AG3', 50),
      EDU: number(sheet, 'AG5', 50)
    },
    derived: {
      hp: { current: number(sheet, 'E10', 10), max: number(sheet, 'G10', number(sheet, 'E10', 10)) },
      san: { current: number(sheet, 'N10', 50), max: number(sheet, 'P10', 99) },
      luck: { current: luck, max: luck },
      mp: { current: number(sheet, 'W10', 10), max: number(sheet, 'Y10', number(sheet, 'W10', 10)) },
      move: number(sheet, 'AF10', 8),
      damageBonus: text(compact, 'C9') || '+0',
      build: number(compact, 'F9', 0)
    },
    skills,
    possessions: parseMultiline(text(sheet, 'B73')),
    wounds: parseStateLines(text(sheet, 'I11')),
    conditions: parseStateLines(text(sheet, 'R11')),
    growthMarks: parseGrowthMarks(sheet)
  };
}

function parseSkills(sheet: ExcelJS.Worksheet): Record<string, number> {
  const skills: Record<string, number> = {};
  for (let row = 16; row <= 49; row += 1) {
    addSkill(skills, sheet, row, LEFT_SKILL);
    addSkill(skills, sheet, row, RIGHT_SKILL);
  }
  return skills;
}

function addSkill(
  skills: Record<string, number>,
  sheet: ExcelJS.Worksheet,
  row: number,
  columns: { flag: string; name: string; specialty: string; value: string }
): void {
  const rawName = text(sheet, `${columns.name}${row}`);
  const value = number(sheet, `${columns.value}${row}`, Number.NaN);
  if (!rawName || Number.isNaN(value)) return;
  const name = normalizeSkillName(rawName, text(sheet, `${columns.specialty}${row}`));
  if (!name || name === '自定义技能') return;
  skills[name] = value;
}

function normalizeSkillName(rawName: string, specialty: string): string {
  const base = rawName.replace(/[①②③Ω]/g, '').trim();
  const cleanSpecialty = specialty.trim();
  if (!base) return '';
  if (base.endsWith('：')) {
    return cleanSpecialty ? `${base}${cleanSpecialty}` : base.slice(0, -1);
  }
  if (cleanSpecialty && /^(技艺|科学|外语|格斗|射击|生存|学识)/.test(base)) {
    return `${base.replace(/[：:]$/, '')}：${cleanSpecialty}`;
  }
  return base;
}

function parseGrowthMarks(sheet: ExcelJS.Worksheet): string[] {
  const marks: string[] = [];
  for (let row = 16; row <= 49; row += 1) {
    for (const columns of [LEFT_SKILL, RIGHT_SKILL]) {
      const mark = text(sheet, `${columns.flag}${row}`);
      if (mark !== '☑' && mark !== '√' && mark !== '✓') continue;
      const skill = normalizeSkillName(text(sheet, `${columns.name}${row}`), text(sheet, `${columns.specialty}${row}`));
      if (skill) marks.push(skill);
    }
  }
  return marks;
}

function requireSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new Error(`角色卡缺少工作表：${name}`);
  return sheet;
}

function text(sheet: ExcelJS.Worksheet | undefined, address: string): string {
  if (!sheet) return '';
  const value = sheet.getCell(address).value;
  return cellToText(value).trim();
}

function number(sheet: ExcelJS.Worksheet | undefined, address: string, fallback: number): number {
  const value = text(sheet, address);
  if (!value || value === '——') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMultiline(value: string): string[] {
  return value
    .split(/\r?\n|、|，/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStateLines(value: string): string[] {
  return value && value !== '健康' && value !== '清醒' ? [value] : [];
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if ('result' in value && value.result != null) return cellToText(value.result as ExcelJS.CellValue);
  if ('text' in value && value.text != null) return String(value.text);
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join('');
  }
  return '';
}
