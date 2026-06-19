import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { createHttpApp } from './app';
import { ingestDirectory } from './library';
import { createFileStore } from './store';

const root = process.cwd();
const port = Number(process.env.PORT ?? 3001);
const sourcesDir = process.env.SOURCES_DIR ?? path.resolve(root, 'sources');
const uploadsDir = path.resolve(root, 'uploads');
const dataPath = path.resolve(root, '.data', 'coc-ai-keeper.sqlite');

const store = await createFileStore(dataPath);
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT']
  }
});

const { app } = createHttpApp({
  store,
  sourcesDir,
  uploadsDir,
  broadcast(roomId, event, payload) {
    io.to(roomId).emit(event, payload);
  }
});

server.on('request', app);

io.on('connection', (socket) => {
  socket.on('room:join', (roomId: string) => {
    socket.join(roomId);
    socket.emit('room:update', store.getRoomState(roomId));
  });
});

server.listen(port, '127.0.0.1', async () => {
  console.log(`COC AI Keeper API listening on http://127.0.0.1:${port}`);
  if (process.env.SKIP_SOURCE_SCAN !== '1') {
    const chunks = await ingestDirectory(sourcesDir);
    if (chunks.length) {
      store.addKnowledge(chunks);
      console.log(`Imported ${chunks.length} knowledge chunks from ${sourcesDir}`);
    }
  }
});
