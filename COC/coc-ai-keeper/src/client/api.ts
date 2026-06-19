import type { Investigator, KeeperResponse, Message, Participant, RollRequest, Room } from '../shared/types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

export interface RoomState {
  room?: Room;
  participants: Participant[];
  investigators: Investigator[];
  messages: Message[];
}

export function socketUrl() {
  return API_BASE;
}

export async function createRoom(name: string): Promise<Room> {
  return request('/api/rooms', { method: 'POST', body: { name } });
}

export async function joinRoom(roomId: string, name: string, role: Participant['role']): Promise<Participant> {
  return request(`/api/rooms/${roomId}/join`, { method: 'POST', body: { name, role } });
}

export async function getRoomState(roomId: string): Promise<RoomState> {
  return request(`/api/rooms/${roomId}`);
}

export async function sendMessage(input: {
  roomId: string;
  senderId?: string;
  senderName: string;
  type: Message['type'];
  text: string;
}): Promise<Message> {
  return request('/api/messages', { method: 'POST', body: input });
}

export async function askKeeper(input: { roomId: string; senderId?: string; action: string }): Promise<KeeperResponse & { message: Message }> {
  return request('/api/ai/respond', { method: 'POST', body: input });
}

export async function runRoll(input: { roomId: string; investigatorId?: string; request: RollRequest }) {
  return request('/api/rolls', { method: 'POST', body: input });
}

export async function updateInvestigator(investigator: Investigator): Promise<Investigator> {
  return request(`/api/investigators/${investigator.id}`, { method: 'PUT', body: investigator });
}

export async function importInvestigatorXlsx(input: {
  roomId: string;
  file: File;
  ownerParticipantId?: string;
}): Promise<Investigator> {
  const body = new FormData();
  body.append('file', input.file);
  if (input.ownerParticipantId) body.append('ownerParticipantId', input.ownerParticipantId);
  return request(`/api/rooms/${input.roomId}/investigators/import`, { method: 'POST', formData: body });
}

export async function ingestLibrary(file?: File) {
  if (file) {
    const body = new FormData();
    body.append('file', file);
    return request('/api/library/ingest', { method: 'POST', formData: body });
  }
  return request('/api/library/ingest', { method: 'POST', body: { mode: 'scan' } });
}

export async function getLibrary() {
  return request('/api/library');
}

export async function searchLibrary(query: string) {
  return request(`/api/library/search?q=${encodeURIComponent(query)}`);
}

async function request(path: string, options: { method?: string; body?: unknown; formData?: FormData } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: options.formData ? undefined : options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? response.statusText);
  }
  return response.json();
}
