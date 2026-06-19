import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { chunkText, ingestDirectory, ingestFile, searchChunks } from '../src/server/library';

describe('library ingestion helpers', () => {
  it('chunks markdown by paragraphs while preserving source metadata', () => {
    const chunks = chunkText({
      sourceName: '研究报告.md',
      sourceType: 'md',
      text: '## 图书馆\n暗门后有潮湿气味。\n\n教授日记提到缅甸石碑。\n\n短'
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      sourceName: '研究报告.md',
      sourceType: 'md',
      index: 0
    });
    expect(chunks[1].text).toContain('缅甸石碑');
  });

  it('filters out paragraphs shorter than 8 characters', () => {
    const chunks = chunkText({
      sourceName: 'test.md',
      sourceType: 'md',
      text: '短\n\n这是一个足够长的段落用于测试。'
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('足够长');
  });

  it('splits long paragraphs at 900 character boundaries', () => {
    const longText = 'A'.repeat(2000);
    const chunks = chunkText({ sourceName: 'long.md', sourceType: 'md', text: longText });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].text.length).toBeLessThanOrEqual(900);
  });

  it('generates deterministic chunk IDs from source name and index', () => {
    const chunks = chunkText({
      sourceName: 'test.md',
      sourceType: 'md',
      text: '第一段内容足够长。\n\n第二段内容也足够长。'
    });
    expect(chunks[0].id).toBe('test-0');
    expect(chunks[1].id).toBe('test-1');
  });

  it('retrieves chunks by mixed Chinese keyword overlap', () => {
    const chunks = chunkText({
      sourceName: 'case.txt',
      sourceType: 'txt',
      text: '图书馆管理员提到暗门。\n\n码头货运记录显示石碑抵达。\n\n无关的天气记录。'
    });

    const results = searchChunks(chunks, '调查 图书馆 暗门', 2);

    expect(results[0].chunk.text).toContain('图书馆管理员');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('returns empty results for unmatched queries', () => {
    const chunks = chunkText({
      sourceName: 'test.txt',
      sourceType: 'txt',
      text: '图书馆管理员提到暗门。'
    });
    const results = searchChunks(chunks, '完全无关的关键词xyz', 5);
    expect(results).toHaveLength(0);
  });

  it('returns empty results for empty query', () => {
    const chunks = chunkText({
      sourceName: 'test.txt',
      sourceType: 'txt',
      text: '图书馆管理员提到暗门。'
    });
    const results = searchChunks(chunks, '', 5);
    expect(results).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    const chunks = chunkText({
      sourceName: 'test.txt',
      sourceType: 'txt',
      text: '图书馆管理员提到暗门。\n\n图书馆地下室有石阶。\n\n图书馆阁楼有旧书。'
    });
    const results = searchChunks(chunks, '图书馆', 1);
    expect(results).toHaveLength(1);
  });

  it('sorts results by score descending', () => {
    const chunks = chunkText({
      sourceName: 'test.txt',
      sourceType: 'txt',
      text: '图书馆管理员提到暗门。\n\n图书馆地下室有石阶，图书馆的灯光昏暗。'
    });
    const results = searchChunks(chunks, '图书馆', 5);
    if (results.length >= 2) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });
});

const tempDir = path.join(import.meta.dirname, '__temp_lib_test');

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('file ingestion', () => {
  it('ingests a markdown file and returns chunks', async () => {
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, 'test.md');
    await fs.writeFile(filePath, '## 标题\n\n这是测试段落内容，足够长用于分块。');

    const chunks = await ingestFile(filePath);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].sourceName).toBe('test.md');
    expect(chunks[0].sourceType).toBe('md');
  });

  it('ingests a txt file', async () => {
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, 'notes.txt');
    await fs.writeFile(filePath, '调查员在码头发现了异常痕迹，需要进一步检查。');

    const chunks = await ingestFile(filePath);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].sourceType).toBe('txt');
  });

  it('returns empty array for unsupported file types', async () => {
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, 'image.png');
    await fs.writeFile(filePath, 'fake image data');

    const chunks = await ingestFile(filePath);
    expect(chunks).toHaveLength(0);
  });

  it('ingests all supported files from a directory', async () => {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(path.join(tempDir, 'a.md'), '第一份资料内容，包含足够长的文本用于测试。');
    await fs.writeFile(path.join(tempDir, 'b.txt'), '第二份资料内容，也包含足够长的文本。');
    await fs.writeFile(path.join(tempDir, 'c.csv'), 'not, supported');

    const chunks = await ingestDirectory(tempDir);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const sources = new Set(chunks.map((c) => c.sourceName));
    expect(sources.has('a.md')).toBe(true);
    expect(sources.has('b.txt')).toBe(true);
  });

  it('returns empty array for non-existent directory', async () => {
    const chunks = await ingestDirectory(path.join(tempDir, 'nonexistent'));
    expect(chunks).toHaveLength(0);
  });
});
