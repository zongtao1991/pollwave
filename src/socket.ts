import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from './config';
import { setShareIoInstance } from './routes/share';
import jwt from 'jsonwebtoken';

interface PollRoom {
  viewers: Set<string>;
}

const pollRooms: Map<number, PollRoom> = new Map();

let io: Server | null = null;

export const getIoInstance = (): Server | null => io;

export const setupSocketIO = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  setShareIoInstance(io);

  io.on('connection', (socket: Socket) => {
    console.log('Socket 连接:', socket.id);

    const token = socket.handshake.auth?.token;
    let userId: number | null = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as { userId: number };
        userId = decoded.userId;
      } catch (e) {
        userId = null;
      }
    }

    socket.on('join_poll', async (data: { pollId: number }) => {
      const { pollId } = data;
      const roomName = `poll_${pollId}`;

      await socket.join(roomName);
      console.log(`Socket ${socket.id} 加入房间 ${roomName}`);

      if (!pollRooms.has(pollId)) {
        pollRooms.set(pollId, { viewers: new Set() });
      }

      const room = pollRooms.get(pollId)!;
      room.viewers.add(socket.id);

      io!.to(roomName).emit('viewer_count', {
        pollId,
        count: room.viewers.size,
      });
    });

    socket.on('leave_poll', async (data: { pollId: number }) => {
      const { pollId } = data;
      const roomName = `poll_${pollId}`;

      await socket.leave(roomName);
      console.log(`Socket ${socket.id} 离开房间 ${roomName}`);

      const room = pollRooms.get(pollId);
      if (room) {
        room.viewers.delete(socket.id);

        io!.to(roomName).emit('viewer_count', {
          pollId,
          count: room.viewers.size,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket 断开连接:', socket.id);

      pollRooms.forEach((room, pollId) => {
        if (room.viewers.has(socket.id)) {
          room.viewers.delete(socket.id);

          io!.to(`poll_${pollId}`).emit('viewer_count', {
            pollId,
            count: room.viewers.size,
          });
        }
      });
    });
  });

  return io;
};

export const broadcastPollStatusChange = (pollId: number, status: string) => {
  if (io) {
    io.to(`poll_${pollId}`).emit('poll_status_changed', {
      pollId,
      status,
    });
  }
};
