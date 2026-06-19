import { describe, expect, it } from 'vitest';
import { createMockKeeperResponse, generateKeeperResponse } from '../src/server/ai';

describe('mock keeper fallback', () => {
  it('returns a structured roll request for a library investigation action', () => {
    const response = createMockKeeperResponse({
      action: '我调查图书馆暗门',
      contextSnippets: ['图书馆地下室有一道暗门，门后传来潮湿气味。']
    });

    expect(response.narrative).toContain('图书馆');
    expect(response.rollRequest?.type).toBe('skill');
    expect(response.rollRequest?.suggestedSkills).toContain('图书馆使用');
    expect(response.sources[0].sourceName).toBe('模拟资料');
  });

  it('does not generate a roll request for non-investigation actions', () => {
    const response = createMockKeeperResponse({
      action: '我和酒保聊天',
      contextSnippets: []
    });

    expect(response.rollRequest).toBeUndefined();
    expect(response.narrative).toContain('酒保');
  });

  it('uses default action text when action is empty', () => {
    const response = createMockKeeperResponse({ action: '', contextSnippets: [] });
    expect(response.narrative).toBeTruthy();
    expect(response.stateSuggestions).toBeDefined();
  });

  it('includes context snippets in keeper notes', () => {
    const response = createMockKeeperResponse({
      action: '调查',
      contextSnippets: ['地下室有古老的石阶']
    });
    expect(response.keeperNotes).toContain('地下室');
  });

  it('generates roll request for door/secret related keywords', () => {
    const response = createMockKeeperResponse({
      action: '我仔细检查暗门后面有什么',
      contextSnippets: []
    });
    expect(response.rollRequest).toBeDefined();
    expect(response.rollRequest?.difficulty).toBe('regular');
  });
});

describe('generateKeeperResponse', () => {
  it('falls back to mock when DEEPSEEK_API_KEY is not set', async () => {
    const original = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const response = await generateKeeperResponse({
        roomName: '阿卡姆图书馆',
        scene: '昏暗的地下室',
        action: '我调查暗门',
        recentMessages: [],
        knowledge: [{ chunk: { id: 'c1', sourceName: 'case.md', sourceType: 'md', index: 0, text: '地下室有古老石阶', createdAt: new Date().toISOString() }, score: 1 }]
      });
      expect(response.narrative).toContain('暗门');
      expect(response.rollRequest).toBeDefined();
      expect(response.keeperNotes).toContain('模拟AI兜底');
    } finally {
      if (original !== undefined) process.env.DEEPSEEK_API_KEY = original;
    }
  });

  it('normalizes partial AI response fields when falling back', async () => {
    const original = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const response = await generateKeeperResponse({
        roomName: '测试',
        scene: '测试场景',
        action: '我和酒保聊天',
        recentMessages: ['玩家：你好'],
        knowledge: []
      });
      expect(response.stateSuggestions).toBeDefined();
      expect(response.sources).toBeDefined();
    } finally {
      if (original !== undefined) process.env.DEEPSEEK_API_KEY = original;
    }
  });
});
