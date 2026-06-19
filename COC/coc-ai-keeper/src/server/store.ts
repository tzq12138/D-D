import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import { searchChunks } from './library';
import type {
  Investigator,
  KnowledgeChunk,
  KnowledgeSearchResult,
  Message,
  Participant,
  Room,
  Visibility
} from '../shared/types';

const require = createRequire(import.meta.url);

export interface AddMessageInput {
  roomId: string;
  senderId?: string;
  senderName: string;
  type: Message['type'];
  text: string;
  visibility?: Visibility;
  metadata?: Record<string, unknown>;
}

export class AppStore {
  constructor(
    private readonly db: Database,
    private readonly filePath?: string
  ) {
    this.migrate();
  }

  createRoom(name: string): Room {
    const room: Room = {
      id: crypto.randomUUID(),
      name: name.trim() || '未命名调查',
      currentScene: '调查员们聚集在阿卡姆，一份不合时宜的线索正等着被打开。',
      createdAt: new Date().toISOString()
    };
    this.db.run('INSERT INTO rooms VALUES (?, ?, ?, ?)', [room.id, room.name, room.currentScene, room.createdAt]);
    this.save();
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.one<Room>('SELECT id, name, currentScene, createdAt FROM rooms WHERE id = ?', [roomId]);
  }

  listRooms(): Room[] {
    return this.all<Room>('SELECT id, name, currentScene, createdAt FROM rooms ORDER BY createdAt DESC');
  }

  joinRoom(roomId: string, name: string, role: Participant['role']): Participant {
    const participantId = crypto.randomUUID();
    const investigatorId = role === 'player' ? crypto.randomUUID() : undefined;
    const participant: Participant = {
      id: participantId,
      roomId,
      name: name.trim() || (role === 'keeper' ? 'Keeper' : '调查员'),
      role,
      investigatorId,
      joinedAt: new Date().toISOString()
    };
    this.db.run('INSERT INTO participants VALUES (?, ?, ?, ?, ?, ?)', [
      participant.id,
      participant.roomId,
      participant.name,
      participant.role,
      participant.investigatorId ?? null,
      participant.joinedAt
    ]);
    if (investigatorId) {
      this.upsertInvestigator(createDefaultInvestigator(roomId, participantId, investigatorId, participant.name));
    }
    this.save();
    return participant;
  }

  listParticipants(roomId: string): Participant[] {
    return this.all<Participant>('SELECT id, roomId, name, role, investigatorId, joinedAt FROM participants WHERE roomId = ? ORDER BY joinedAt', [roomId]);
  }

  upsertInvestigator(investigator: Investigator): Investigator {
    this.db.run(
      `INSERT INTO investigators VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        roomId=excluded.roomId,
        ownerParticipantId=excluded.ownerParticipantId,
        name=excluded.name,
        occupation=excluded.occupation,
        age=excluded.age,
        attributes=excluded.attributes,
        derived=excluded.derived,
        skills=excluded.skills,
        possessions=excluded.possessions,
        wounds=excluded.wounds,
        conditions=excluded.conditions,
        growthMarks=excluded.growthMarks`,
      [
        investigator.id,
        investigator.roomId,
        investigator.ownerParticipantId ?? null,
        investigator.name,
        investigator.occupation,
        investigator.age,
        JSON.stringify(investigator.attributes),
        JSON.stringify(investigator.derived),
        JSON.stringify(investigator.skills),
        JSON.stringify(investigator.possessions),
        JSON.stringify(investigator.wounds),
        JSON.stringify(investigator.conditions),
        JSON.stringify(investigator.growthMarks)
      ]
    );
    this.save();
    return investigator;
  }

  getInvestigator(id: string): Investigator | undefined {
    const row = this.one<Record<string, unknown>>('SELECT * FROM investigators WHERE id = ?', [id]);
    return row ? parseInvestigator(row) : undefined;
  }

  listInvestigators(roomId: string): Investigator[] {
    return this.all<Record<string, unknown>>('SELECT * FROM investigators WHERE roomId = ? ORDER BY name', [roomId]).map(parseInvestigator);
  }

  addMessage(input: AddMessageInput): Message {
    const message: Message = {
      id: crypto.randomUUID(),
      roomId: input.roomId,
      senderId: input.senderId,
      senderName: input.senderName,
      type: input.type,
      text: input.text,
      visibility: input.visibility ?? 'public',
      metadata: input.metadata,
      createdAt: new Date().toISOString()
    };
    this.db.run('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      message.id,
      message.roomId,
      message.senderId ?? null,
      message.senderName,
      message.type,
      message.text,
      message.visibility,
      message.metadata ? JSON.stringify(message.metadata) : null,
      message.createdAt
    ]);
    this.save();
    return message;
  }

  listMessages(roomId: string, limit = 100): Message[] {
    return this.all<Record<string, unknown>>(
      'SELECT * FROM messages WHERE roomId = ? ORDER BY createdAt DESC LIMIT ?',
      [roomId, limit]
    )
      .map(parseMessage)
      .reverse();
  }

  replaceKnowledge(chunks: KnowledgeChunk[]): void {
    this.db.run('DELETE FROM knowledge_chunks');
    this.addKnowledge(chunks);
  }

  addKnowledge(chunks: KnowledgeChunk[]): void {
    const statement = this.db.prepare('INSERT OR REPLACE INTO knowledge_chunks VALUES (?, ?, ?, ?, ?, ?)');
    for (const chunk of chunks) {
      statement.run([chunk.id, chunk.sourceName, chunk.sourceType, chunk.index, chunk.text, chunk.createdAt]);
    }
    statement.free();
    this.save();
  }

  listKnowledge(limit = 200): KnowledgeChunk[] {
    return this.all<KnowledgeChunk>(
      'SELECT id, sourceName, sourceType, "index", text, createdAt FROM knowledge_chunks ORDER BY createdAt DESC, sourceName, "index" LIMIT ?',
      [limit]
    );
  }

  searchKnowledge(query: string, limit = 5): KnowledgeSearchResult[] {
    return searchChunks(this.listKnowledge(2000), query, limit);
  }

  getRoomState(roomId: string) {
    return {
      room: this.getRoom(roomId),
      participants: this.listParticipants(roomId),
      investigators: this.listInvestigators(roomId),
      messages: this.listMessages(roomId)
    };
  }

  save(): void {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, Buffer.from(this.db.export()));
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currentScene TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        investigatorId TEXT,
        joinedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS investigators (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        ownerParticipantId TEXT,
        name TEXT NOT NULL,
        occupation TEXT NOT NULL,
        age INTEGER NOT NULL,
        attributes TEXT NOT NULL,
        derived TEXT NOT NULL,
        skills TEXT NOT NULL,
        possessions TEXT NOT NULL,
        wounds TEXT NOT NULL,
        conditions TEXT NOT NULL,
        growthMarks TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        senderId TEXT,
        senderName TEXT NOT NULL,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        visibility TEXT NOT NULL,
        metadata TEXT,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        sourceName TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        "index" INTEGER NOT NULL,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
  }

  private all<T>(sql: string, params: SqlValue[] = []): T[] {
    const statement = this.db.prepare(sql, params);
    const rows: T[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }
    statement.free();
    return rows;
  }

  private one<T>(sql: string, params: SqlValue[] = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }
}

export async function createMemoryStore(): Promise<AppStore> {
  const SQL = await initSqlJs({ locateFile });
  return new AppStore(new SQL.Database());
}

export async function createFileStore(filePath: string): Promise<AppStore> {
  const SQL = await initSqlJs({ locateFile });
  const bytes = fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined;
  return new AppStore(bytes ? new SQL.Database(bytes) : new SQL.Database(), filePath);
}

function locateFile(file: string): string {
  if (file.endsWith('.wasm')) return require.resolve(`sql.js/dist/${file}`);
  return file;
}

function createDefaultInvestigator(roomId: string, ownerParticipantId: string, id: string, name: string): Investigator {
  return {
    id,
    roomId,
    ownerParticipantId,
    name,
    occupation: '私家侦探',
    age: 32,
    attributes: {
      STR: 50,
      CON: 55,
      SIZ: 60,
      DEX: 60,
      APP: 50,
      INT: 65,
      POW: 55,
      EDU: 70
    },
    derived: {
      hp: { current: 11, max: 11 },
      san: { current: 55, max: 55 },
      luck: { current: 50, max: 50 },
      mp: { current: 11, max: 11 },
      move: 8,
      damageBonus: '+0',
      build: 0
    },
    skills: {
      侦查: 60,
      聆听: 50,
      图书馆使用: 55,
      心理学: 40,
      魅惑: 35,
      斗殴: 40,
      闪避: 30,
      神秘学: 25
    },
    possessions: ['笔记本', '钢笔', '手电筒'],
    wounds: [],
    conditions: [],
    growthMarks: []
  };
}

function parseInvestigator(row: Record<string, unknown>): Investigator {
  return {
    id: String(row.id),
    roomId: String(row.roomId),
    ownerParticipantId: row.ownerParticipantId ? String(row.ownerParticipantId) : undefined,
    name: String(row.name),
    occupation: String(row.occupation),
    age: Number(row.age),
    attributes: JSON.parse(String(row.attributes)),
    derived: JSON.parse(String(row.derived)),
    skills: JSON.parse(String(row.skills)),
    possessions: JSON.parse(String(row.possessions)),
    wounds: JSON.parse(String(row.wounds)),
    conditions: JSON.parse(String(row.conditions)),
    growthMarks: JSON.parse(String(row.growthMarks))
  };
}

function parseMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    roomId: String(row.roomId),
    senderId: row.senderId ? String(row.senderId) : undefined,
    senderName: String(row.senderName),
    type: row.type as Message['type'],
    text: String(row.text),
    visibility: row.visibility as Visibility,
    metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
    createdAt: String(row.createdAt)
  };
}
