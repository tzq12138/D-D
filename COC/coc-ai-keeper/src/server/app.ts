import fs from 'node:fs/promises';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { generateKeeperResponse } from './ai';
import { ingestDirectory, ingestFile } from './library';
import type { AppStore } from './store';
import { parseInvestigatorXlsx } from './xlsxCharacter';
import { resolveSanCheck, skillCheck } from '../shared/cocRules';
import type { Message, RollRequest } from '../shared/types';

export interface CreateHttpAppOptions {
  store: AppStore;
  sourcesDir: string;
  uploadsDir?: string;
  broadcast?: (roomId: string, event: string, payload: unknown) => void;
}

export function createHttpApp(options: CreateHttpAppOptions) {
  const app = express();
  const upload = multer({ dest: options.uploadsDir ?? path.resolve(process.cwd(), 'uploads') });

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.post('/api/rooms', (request, response) => {
    const room = options.store.createRoom(request.body?.name ?? '阿卡姆调查');
    options.store.addMessage({
      roomId: room.id,
      senderName: '系统',
      type: 'system',
      text: `房间「${room.name}」已创建。`,
      visibility: 'public'
    });
    response.json(room);
  });

  app.get('/api/rooms', (_request, response) => {
    response.json(options.store.listRooms());
  });

  app.get('/api/rooms/:id', (request, response) => {
    response.json(options.store.getRoomState(request.params.id));
  });

  app.post('/api/rooms/:id/join', (request, response) => {
    const role = request.body?.role === 'keeper' ? 'keeper' : 'player';
    const participant = options.store.joinRoom(request.params.id, request.body?.name ?? '', role);
    const message = options.store.addMessage({
      roomId: request.params.id,
      senderId: participant.id,
      senderName: '系统',
      type: 'system',
      text: `${participant.name} 加入了调查。`,
      visibility: 'public'
    });
    broadcastState(options, request.params.id, message);
    response.json(participant);
  });

  app.post('/api/messages', (request, response) => {
    const message = options.store.addMessage({
      roomId: request.body.roomId,
      senderId: request.body.senderId,
      senderName: request.body.senderName ?? '调查员',
      type: request.body.type ?? 'player',
      text: request.body.text,
      visibility: request.body.visibility ?? 'public',
      metadata: request.body.metadata
    });
    broadcastState(options, request.body.roomId, message);
    response.json(message);
  });

  app.post('/api/ai/respond', async (request, response, next) => {
    try {
      const room = options.store.getRoom(request.body.roomId);
      if (!room) {
        response.status(404).json({ error: 'Room not found' });
        return;
      }
      const recentMessages = options.store
        .listMessages(room.id, 12)
        .map((message) => `${message.senderName}: ${message.text}`);
      const knowledge = options.store.searchKnowledge(request.body.action ?? '', 5);
      const keeper = await generateKeeperResponse({
        roomName: room.name,
        scene: room.currentScene,
        action: request.body.action ?? '',
        recentMessages,
        knowledge
      });
      const message = options.store.addMessage({
        roomId: room.id,
        senderName: 'AI守秘人',
        type: 'ai',
        text: keeper.narrative,
        visibility: 'public',
        metadata: {
          rollRequest: keeper.rollRequest,
          stateSuggestions: keeper.stateSuggestions,
          keeperNotes: keeper.keeperNotes,
          sources: keeper.sources
        }
      });
      broadcastState(options, room.id, message);
      response.json({ ...keeper, message });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/rolls', (request, response) => {
    const roomId = request.body.roomId;
    const investigator = request.body.investigatorId ? options.store.getInvestigator(request.body.investigatorId) : undefined;
    const rollRequest = request.body.request as RollRequest & { forced?: { unit: number; tens: number[] }; intRoll?: number; lossRolls?: number[] };

    if (rollRequest.type === 'san') {
      const currentSan = investigator?.derived.san.current ?? 50;
      const intValue = investigator?.attributes.INT ?? 50;
      const result = resolveSanCheck({
        currentSan,
        intValue,
        expression: rollRequest.sanExpression ?? '0/1D6',
        sanRoll: rollRequest.forced ? undefined : undefined,
        lossRolls: rollRequest.lossRolls,
        intRoll: rollRequest.intRoll
      });
      if (investigator) {
        investigator.derived.san.current = result.newSan;
        options.store.upsertInvestigator(investigator);
      }
      const message = addRollMessage(options, roomId, `SAN检定 ${result.sanRoll}，损失 ${result.loss} 点理智，当前SAN ${result.newSan}。`, result, rollRequest.id);
      response.json({ result, message });
      return;
    }

    const skillName = rollRequest.skillName ?? rollRequest.suggestedSkills?.[0] ?? '侦查';
    const skillValue = rollRequest.skillValue ?? investigator?.skills[skillName] ?? investigator?.attributes[skillName] ?? 50;
    const result = skillCheck({
      skillName,
      skillValue,
      difficulty: rollRequest.difficulty ?? 'regular',
      bonusDice: rollRequest.bonusDice,
      penaltyDice: rollRequest.penaltyDice,
      forced: rollRequest.forced
    });
    const message = addRollMessage(
      options,
      roomId,
      `${investigator?.name ?? '调查员'} 进行 ${skillName} 检定：${result.roll.total} / ${skillValue}，${result.level}，${result.passed ? '通过' : '失败'}。`,
      result,
      rollRequest.id
    );
    response.json({ result, message });
  });

  app.get('/api/library', (_request, response) => {
    const chunks = options.store.listKnowledge(100);
    response.json({ count: chunks.length, chunks });
  });

  app.get('/api/library/search', (request, response) => {
    response.json(options.store.searchKnowledge(String(request.query.q ?? ''), Number(request.query.limit ?? 5)));
  });

  app.post('/api/library/ingest', upload.single('file'), async (request, response, next) => {
    try {
      let chunks = [];
      if (request.file) {
        const targetPath = path.join(request.file.destination, request.file.originalname);
        await fs.rename(request.file.path, targetPath);
        chunks = await ingestFile(targetPath);
      } else {
        chunks = await ingestDirectory(options.sourcesDir);
      }
      options.store.addKnowledge(chunks);
      options.broadcast?.('library', 'library:update', { count: options.store.listKnowledge(5000).length });
      response.json({ imported: chunks.length, total: options.store.listKnowledge(5000).length });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/rooms/:id/investigators/import', upload.single('file'), async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: 'Missing xlsx file' });
        return;
      }
      const targetPath = path.join(request.file.destination, request.file.originalname);
      await fs.rename(request.file.path, targetPath);
      const investigator = await parseInvestigatorXlsx(targetPath, {
        roomId: request.params.id,
        ownerParticipantId: request.body?.ownerParticipantId
      });
      options.store.upsertInvestigator(investigator);
      const message = options.store.addMessage({
        roomId: request.params.id,
        senderName: '系统',
        type: 'system',
        text: `已导入角色卡：${investigator.name}（${investigator.occupation}）。`,
        visibility: 'public',
        metadata: { investigatorId: investigator.id }
      });
      broadcastState(options, request.params.id, message);
      response.json(investigator);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/investigators/:id', (request, response) => {
    const current = options.store.getInvestigator(request.params.id);
    if (!current) {
      response.status(404).json({ error: 'Investigator not found' });
      return;
    }
    const nextInvestigator = {
      ...current,
      ...request.body,
      derived: { ...current.derived, ...(request.body?.derived ?? {}) },
      attributes: { ...current.attributes, ...(request.body?.attributes ?? {}) },
      skills: { ...current.skills, ...(request.body?.skills ?? {}) }
    };
    options.store.upsertInvestigator(nextInvestigator);
    options.broadcast?.(current.roomId, 'room:update', options.store.getRoomState(current.roomId));
    response.json(nextInvestigator);
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  });

  return { app };
}

function addRollMessage(options: CreateHttpAppOptions, roomId: string, text: string, result: unknown, rollRequestId?: string): Message {
  const message = options.store.addMessage({
    roomId,
    senderName: '骰子系统',
    type: 'roll',
    text,
    visibility: 'public',
    metadata: { result, rollRequestId }
  });
  broadcastState(options, roomId, message);
  return message;
}

function broadcastState(options: CreateHttpAppOptions, roomId: string, message?: Message): void {
  if (message) options.broadcast?.(roomId, 'message:new', message);
  options.broadcast?.(roomId, 'room:update', options.store.getRoomState(roomId));
}
