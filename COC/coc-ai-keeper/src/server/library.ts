import fs from 'node:fs/promises';
import path from 'node:path';
import pdfParse from 'pdf-parse';
import type { KnowledgeChunk, KnowledgeSearchResult } from '../shared/types';

export interface ChunkTextInput {
  sourceName: string;
  sourceType: string;
  text: string;
}

export function chunkText(input: ChunkTextInput): KnowledgeChunk[] {
  const paragraphs = input.text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|(?<=。)\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length >= 8);

  const chunks: KnowledgeChunk[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 900) {
      chunks.push(toChunk(input, chunks.length, paragraph));
      continue;
    }
    for (let start = 0; start < paragraph.length; start += 900) {
      chunks.push(toChunk(input, chunks.length, paragraph.slice(start, start + 900)));
    }
  }
  return chunks;
}

export function searchChunks(chunks: KnowledgeChunk[], query: string, limit = 5): KnowledgeSearchResult[] {
  const terms = tokenize(query);
  if (!terms.length) return [];

  return chunks
    .map((chunk) => {
      const text = chunk.text.toLowerCase();
      const score = terms.reduce((sum, term) => sum + countOccurrences(text, term), 0);
      return { chunk, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index)
    .slice(0, limit);
}

export async function ingestFile(filePath: string): Promise<KnowledgeChunk[]> {
  const ext = path.extname(filePath).toLowerCase();
  const sourceName = path.basename(filePath);
  let text = '';

  if (ext === '.md' || ext === '.txt') {
    text = await fs.readFile(filePath, 'utf8');
  } else if (ext === '.pdf') {
    const data = await fs.readFile(filePath);
    const parsed = await pdfParse(data);
    text = parsed.text;
  } else {
    return [];
  }

  return chunkText({ sourceName, sourceType: ext.replace('.', ''), text });
}

export async function ingestDirectory(directory: string): Promise<KnowledgeChunk[]> {
  const files = await listSupportedFiles(directory);
  const allChunks: KnowledgeChunk[] = [];
  for (const file of files) {
    allChunks.push(...(await ingestFile(file)));
  }
  return allChunks;
}

async function listSupportedFiles(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listSupportedFiles(fullPath)));
      } else if (/\.(md|txt|pdf)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  } catch {
    return [];
  }
}

function toChunk(input: ChunkTextInput, index: number, text: string): KnowledgeChunk {
  return {
    id: `${slug(input.sourceName)}-${index}`,
    sourceName: input.sourceName,
    sourceType: input.sourceType,
    index,
    text,
    createdAt: new Date().toISOString()
  };
}

function tokenize(query: string): string[] {
  const ascii = query
    .toLowerCase()
    .match(/[a-z0-9_]+/g) ?? [];
  const chinese = query.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const chinesePairs = chinese.flatMap((part) => {
    const pairs: string[] = [part];
    for (let i = 0; i < part.length - 1; i += 1) {
      pairs.push(part.slice(i, i + 2));
    }
    return pairs;
  });
  return Array.from(new Set([...ascii, ...chinesePairs]));
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let index = text.indexOf(term);
  while (index >= 0) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}
