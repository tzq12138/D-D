import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getRoomState, socketUrl, type RoomState } from './api';

export function useRoomState(roomId: string) {
  const [state, setState] = useState<RoomState>({ participants: [], investigators: [], messages: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getRoomState(roomId)
      .then((next) => active && setState(next))
      .catch((err) => active && setError(err.message));

    const socket = io(socketUrl(), { transports: ['websocket', 'polling'] });
    socket.emit('room:join', roomId);
    socket.on('room:update', (next: RoomState) => setState(next));
    socket.on('connect_error', (err) => setError(err.message));

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [roomId]);

  return { state, setState, error };
}
