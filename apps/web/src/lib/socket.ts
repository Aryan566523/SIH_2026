import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private isConnecting = false;

  connect() {
    if (this.socket?.connected || this.isConnecting) return this.socket;

    this.isConnecting = true;
    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket');
      this.isConnecting = false;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  joinRoom(room: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join-room', { room });
    }
  }

  leaveRoom(room: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave-room', { room });
    }
  }
}

export const socketService = new SocketService();
