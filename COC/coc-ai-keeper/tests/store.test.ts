import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/server/store';

describe('app store', () => {
  it('creates rooms, joins players, creates an investigator, and records messages', async () => {
    const store = await createMemoryStore();
    const room = store.createRoom('阿卡姆夜谈');
    const participant = store.joinRoom(room.id, '温特斯', 'player');
    const investigators = store.listInvestigators(room.id);
    const message = store.addMessage({
      roomId: room.id,
      senderId: participant.id,
      senderName: participant.name,
      type: 'player',
      text: '我调查图书馆暗门',
      visibility: 'public'
    });

    expect(participant.investigatorId).toBeTruthy();
    expect(investigators[0].ownerParticipantId).toBe(participant.id);
    expect(store.listMessages(room.id)).toEqual([message]);
  });

  it('lists rooms in reverse chronological order', async () => {
    const store = await createMemoryStore();
    store.createRoom('房间A');
    await new Promise((resolve) => setTimeout(resolve, 5));
    store.createRoom('房间B');
    const rooms = store.listRooms();
    expect(rooms).toHaveLength(2);
    expect(rooms[0].name).toBe('房间B');
  });

  it('returns undefined for non-existent room', async () => {
    const store = await createMemoryStore();
    expect(store.getRoom('nonexistent')).toBeUndefined();
  });

  it('returns full room state with participants and investigators', async () => {
    const store = await createMemoryStore();
    const room = store.createRoom('测试房间');
    store.joinRoom(room.id, '玩家A', 'player');
    store.joinRoom(room.id, 'Keeper', 'keeper');
    const state = store.getRoomState(room.id);
    expect(state.room?.name).toBe('测试房间');
    expect(state.participants).toHaveLength(2);
    expect(state.investigators).toHaveLength(1);
    expect(state.messages).toHaveLength(0);
  });

  it('creates default investigator when player joins', async () => {
    const store = await createMemoryStore();
    const room = store.createRoom('测试');
    const player = store.joinRoom(room.id, '温特斯', 'player');
    const investigator = store.getInvestigator(player.investigatorId!);
    expect(investigator).toBeDefined();
    expect(investigator!.name).toBe('温特斯');
    expect(investigator!.occupation).toBe('私家侦探');
    expect(investigator!.derived.hp.current).toBeGreaterThan(0);
  });

  it('keeper joins without investigator', async () => {
    const store = await createMemoryStore();
    const room = store.createRoom('测试');
    const keeper = store.joinRoom(room.id, 'Keeper', 'keeper');
    expect(keeper.investigatorId).toBeUndefined();
  });

  it('upserts investigator on update', async () => {
    const store = await createMemoryStore();
    const room = store.createRoom('测试');
    const player = store.joinRoom(room.id, '温特斯', 'player');
    const investigator = store.getInvestigator(player.investigatorId!)!;
    investigator.derived.san.current = 40;
    store.upsertInvestigator(investigator);
    const updated = store.getInvestigator(investigator.id);
    expect(updated!.derived.san.current).toBe(40);
  });

  it('stores and searches knowledge chunks through the same state layer used by the API', async () => {
    const store = await createMemoryStore();
    store.replaceKnowledge([
      {
        id: 'chunk-1',
        sourceName: 'case.md',
        sourceType: 'md',
        index: 0,
        text: '图书馆暗门后面藏着潮湿的地下楼梯。',
        createdAt: new Date('2026-05-25T00:00:00Z').toISOString()
      }
    ]);

    const results = store.searchKnowledge('图书馆 暗门', 3);

    expect(results[0].chunk.sourceName).toBe('case.md');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('adds messages with keeper visibility', async () => {
    const store = await createMemoryStore();
    const room = store.createRoom('测试');
    const msg = store.addMessage({
      roomId: room.id,
      senderName: 'Keeper',
      type: 'keeper',
      text: '守秘人笔记',
      visibility: 'keeper'
    });
    expect(msg.visibility).toBe('keeper');
  });

  it('stores and retrieves metadata on messages', async () => {
    const store = await createMemoryStore();
    const room = store.createRoom('测试');
    const msg = store.addMessage({
      roomId: room.id,
      senderName: '系统',
      type: 'roll',
      text: '掷骰结果',
      visibility: 'public',
      metadata: { result: { total: 42 } }
    });
    const messages = store.listMessages(room.id);
    expect(messages[0].metadata?.result).toEqual({ total: 42 });
  });
});
