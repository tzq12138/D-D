// @vitest-environment node
import { AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createHttpApp } from '../src/server/app';
import { createMemoryStore } from '../src/server/store';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error?: Error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe('HTTP API flow', () => {
  it('creates a room, joins a player, gets a mock AI roll request, and resolves the roll', async () => {
    const store = await createMemoryStore();
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const room = await postJson(`${baseUrl}/api/rooms`, { name: '阿卡姆演示' });
    const participant = await postJson(`${baseUrl}/api/rooms/${room.id}/join`, { name: '温特斯', role: 'player' });
    const ai = await postJson(`${baseUrl}/api/ai/respond`, {
      roomId: room.id,
      senderId: participant.id,
      action: '我调查图书馆暗门'
    });
    const roll = await postJson(`${baseUrl}/api/rolls`, {
      roomId: room.id,
      investigatorId: participant.investigatorId,
      request: {
        ...ai.rollRequest,
        forced: { unit: 0, tens: [3] }
      }
    });

    expect(ai.rollRequest.skillName).toBe('图书馆使用');
    expect(roll.result.passed).toBe(true);
    expect(roll.message.text).toContain('图书馆使用');
    expect(roll.message.metadata.rollRequestId).toBe(ai.rollRequest.id);
  });

  it('imports a xlsx investigator into a room', async () => {
    const store = await createMemoryStore();
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const room = await postJson(`${baseUrl}/api/rooms`, { name: '角色卡导入' });
    const form = new FormData();
    const bytes = await fs.readFile(path.resolve('..', 'tzq12138.xlsx'));
    form.append('file', new Blob([bytes]), 'tzq12138.xlsx');

    const imported = await fetch(`${baseUrl}/api/rooms/${room.id}/investigators/import`, {
      method: 'POST',
      body: form
    }).then(async (response) => {
      const json = await response.json();
      expect(response.ok, JSON.stringify(json)).toBe(true);
      return json;
    });

    expect(imported.name).toBe('阿尔伯特·格雷');
    expect(imported.skills['技艺：表演']).toBe(80);
    expect(store.listInvestigators(room.id)[0].name).toBe('阿尔伯特·格雷');
  });

  it('returns empty room state for non-existent room', async () => {
    const store = await createMemoryStore();
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const response = await fetch(`${baseUrl}/api/rooms/nonexistent`);
    expect(response.ok).toBe(true);
    const state = await response.json();
    expect(state.room).toBeFalsy();
  });

  it('lists rooms via GET', async () => {
    const store = await createMemoryStore();
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    await postJson(`${baseUrl}/api/rooms`, { name: '房间A' });
    await postJson(`${baseUrl}/api/rooms`, { name: '房间B' });

    const response = await fetch(`${baseUrl}/api/rooms`);
    const rooms = await response.json();
    expect(rooms.length).toBe(2);
  });

  it('returns room state with participants and messages', async () => {
    const store = await createMemoryStore();
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const room = await postJson(`${baseUrl}/api/rooms`, { name: '测试房间' });
    await postJson(`${baseUrl}/api/rooms/${room.id}/join`, { name: '玩家A', role: 'player' });

    const stateResponse = await fetch(`${baseUrl}/api/rooms/${room.id}`);
    const state = await stateResponse.json();
    expect(state.room.name).toBe('测试房间');
    expect(state.participants.length).toBe(1);
  });

  it('sends and retrieves messages', async () => {
    const store = await createMemoryStore();
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const room = await postJson(`${baseUrl}/api/rooms`, { name: '消息测试' });
    await postJson(`${baseUrl}/api/messages`, {
      roomId: room.id,
      senderName: 'Keeper',
      type: 'keeper',
      text: '守秘人开场白',
      visibility: 'public'
    });

    const stateResponse = await fetch(`${baseUrl}/api/rooms/${room.id}`);
    const state = await stateResponse.json();
    expect(state.messages.length).toBeGreaterThanOrEqual(1);
    const keeperMsg = state.messages.find((m: { text: string }) => m.text === '守秘人开场白');
    expect(keeperMsg).toBeDefined();
  });

  it('updates investigator state', async () => {
    const store = await createMemoryStore();
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const room = await postJson(`${baseUrl}/api/rooms`, { name: '状态测试' });
    const player = await postJson(`${baseUrl}/api/rooms/${room.id}/join`, { name: '温特斯', role: 'player' });
    const investigator = store.getInvestigator(player.investigatorId)!;

    investigator.derived.hp.current = 5;
    const updateResponse = await fetch(`${baseUrl}/api/investigators/${investigator.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(investigator)
    });
    expect(updateResponse.ok).toBe(true);

    const updated = store.getInvestigator(investigator.id)!;
    expect(updated.derived.hp.current).toBe(5);
  });

  it('scans sources directory via ingest endpoint', async () => {
    const store = await createMemoryStore();
    const tempSources = path.join(import.meta.dirname, '__temp_sources');
    await fs.mkdir(tempSources, { recursive: true });
    await fs.writeFile(path.join(tempSources, 'test.md'), '测试资料内容，包含足够长的文本用于分块和检索。');

    try {
      const { app } = createHttpApp({ store, sourcesDir: tempSources });
      const server = app.listen(0);
      servers.push(server);
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

      const ingestResponse = await fetch(`${baseUrl}/api/library/ingest`, { method: 'POST' });
      expect(ingestResponse.ok).toBe(true);
      const result = await ingestResponse.json();
      expect(result.imported).toBeGreaterThan(0);
    } finally {
      await fs.rm(tempSources, { recursive: true, force: true });
    }
  });

  it('searches knowledge via library search endpoint', async () => {
    const store = await createMemoryStore();
    store.replaceKnowledge([{
      id: 'chunk-1',
      sourceName: 'test.md',
      sourceType: 'md',
      index: 0,
      text: '图书馆管理员提到暗门后面有潮湿气味。',
      createdAt: new Date().toISOString()
    }]);
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const response = await fetch(`${baseUrl}/api/library/search?q=图书馆&limit=3`);
    expect(response.ok).toBe(true);
    const results = await response.json();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.sourceName).toBe('test.md');
  });

  it('returns health check', async () => {
    const store = await createMemoryStore();
    const { app } = createHttpApp({ store, sourcesDir: 'unused' });
    const server = app.listen(0);
    servers.push(server);
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  expect(response.ok).toBe(true);
  return response.json();
}
