import type { KeeperResponse, KnowledgeSearchResult, RollRequest } from '../shared/types';

export interface MockKeeperInput {
  action: string;
  contextSnippets: string[];
}

export interface KeeperAiInput {
  roomName: string;
  scene: string;
  action: string;
  recentMessages: string[];
  knowledge: KnowledgeSearchResult[];
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export function createMockKeeperResponse(input: MockKeeperInput): KeeperResponse {
  const action = input.action || '调查员保持警惕，等待下一步行动。';
  const isLibraryAction = /图书馆|书架|档案|暗门|调查/.test(action);
  const firstSnippet = input.contextSnippets[0] ?? '暂无可用资料，守秘人根据当前场景继续推进。';
  const rollRequest: RollRequest | undefined = isLibraryAction
    ? {
        id: crypto.randomUUID(),
        type: 'skill',
        label: '调查图书馆线索',
        skillName: '图书馆使用',
        suggestedSkills: ['图书馆使用', '侦查'],
        difficulty: 'regular',
        bonusDice: 0,
        penaltyDice: 0,
        reason: '调查员正在从书架、档案或暗门痕迹中寻找可验证的线索。',
        visibility: 'public'
      }
    : undefined;

  return {
    narrative: isLibraryAction
      ? `图书馆的空气像被旧纸和潮气压低了一层。你沿着${action.includes('暗门') ? '墙边暗门' : '书架'}查看，某些痕迹并不急于显露自己。${rollRequest ? '这需要一次图书馆使用或侦查检定。' : ''}`
      : `守秘人翻开记录，低声接住你的行动：“${action}”。场景继续向前推进，但真相暂时仍藏在阴影后。`,
    rollRequest,
    stateSuggestions: rollRequest ? ['等待软件完成技能检定后，再根据结果释放线索。'] : [],
    keeperNotes: `模拟AI兜底：已使用资料片段摘要，不依赖外部API。资料提示：${firstSnippet.slice(0, 80)}`,
    sources: [
      {
        sourceName: '模拟资料',
        excerpt: firstSnippet.slice(0, 140)
      }
    ]
  };
}

export async function generateKeeperResponse(input: KeeperAiInput): Promise<KeeperResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return createMockKeeperResponse({
      action: input.action,
      contextSnippets: input.knowledge.map((result) => result.chunk.text)
    });
  }

  const system = buildSystemPrompt(input);
  const user = [
    `当前房间：${input.roomName}`,
    `当前场景：${input.scene}`,
    `玩家行动：${input.action}`,
    `最近记录：\n${input.recentMessages.slice(-8).join('\n') || '无'}`,
    `资料片段：\n${input.knowledge.map((result, index) => `[${index + 1}] ${result.chunk.sourceName}: ${result.chunk.text.slice(0, 600)}`).join('\n\n') || '无'}`
  ].join('\n\n');

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.8
      })
    });

    if (!response.ok) throw new Error(`DeepSeek API ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek response missing content');
    return normalizeAiResponse(JSON.parse(content), input);
  } catch (error) {
    const fallback = createMockKeeperResponse({
      action: input.action,
      contextSnippets: input.knowledge.map((result) => result.chunk.text)
    });
    fallback.keeperNotes = `真实AI调用失败，已切换模拟KP：${error instanceof Error ? error.message : String(error)}`;
    return fallback;
  }
}

function buildSystemPrompt(input: KeeperAiInput): string {
  return [
    '你是《克苏鲁的呼唤》第七版的AI守秘人。你负责推进调查、扮演NPC、控制恐怖氛围和信息释放。',
    '软件负责所有骰子和硬规则判定。需要检定时，你只能提出检定请求，不要自行决定掷骰结果。',
    '不要一次性剧透真相。每次回应最多释放一个明确线索碎片。',
    '输出必须是JSON对象，字段为 narrative, rollRequest, stateSuggestions, keeperNotes。',
    'rollRequest为空或包含 type, label, skillName, suggestedSkills, difficulty, reason。',
    `当前场景基调：${input.scene || '调查开始'}`
  ].join('\n');
}

function normalizeAiResponse(raw: Partial<KeeperResponse>, input: KeeperAiInput): KeeperResponse {
  const rollRequest = raw.rollRequest
    ? {
        id: crypto.randomUUID(),
        type: raw.rollRequest.type ?? 'skill',
        label: raw.rollRequest.label ?? '守秘人请求检定',
        skillName: raw.rollRequest.skillName,
        suggestedSkills: raw.rollRequest.suggestedSkills ?? (raw.rollRequest.skillName ? [raw.rollRequest.skillName] : ['侦查']),
        difficulty: raw.rollRequest.difficulty ?? 'regular',
        bonusDice: raw.rollRequest.bonusDice ?? 0,
        penaltyDice: raw.rollRequest.penaltyDice ?? 0,
        reason: raw.rollRequest.reason ?? 'AI守秘人认为该行动具有戏剧性风险。',
        visibility: raw.rollRequest.visibility ?? 'public'
      }
    : undefined;

  return {
    narrative: raw.narrative || `守秘人观察着你的行动：“${input.action}”。`,
    rollRequest,
    stateSuggestions: Array.isArray(raw.stateSuggestions) ? raw.stateSuggestions : [],
    keeperNotes: raw.keeperNotes || 'DeepSeek返回已规范化。',
    sources: input.knowledge.slice(0, 3).map((result) => ({
      sourceName: result.chunk.sourceName,
      excerpt: result.chunk.text.slice(0, 160)
    }))
  };
}
