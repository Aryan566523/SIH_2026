import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { WSInvestigationProgress, WSAlert, WSGraphUpdate } from '@chainsentinel/types';

@WSGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(WebSocketGateway.name);
  private connectedClients = new Map<string, { userId?: string; rooms: Set<string> }>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, { rooms: new Set() });

    // Join default room
    client.join('global');
    this.connectedClients.get(client.id)!.rooms.add('global');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }) {
    client.join(data.room);
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.rooms.add(data.room);
    }
    this.logger.log(`Client ${client.id} joined room: ${data.room}`);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }) {
    client.leave(data.room);
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.rooms.delete(data.room);
    }
  }

  // Emit investigation progress
  emitInvestigationProgress(caseId: string, data: WSInvestigationProgress) {
    this.server.to(`case:${caseId}`).emit('investigation:progress', data);
    this.logger.debug(`Investigation progress emitted for case ${caseId}`);
  }

  // Emit alert
  emitAlert(organizationId: string, data: WSAlert) {
    this.server.to(`org:${organizationId}`).emit('alert:new', data);
  }

  // Emit graph update
  emitGraphUpdate(caseId: string, data: WSGraphUpdate) {
    this.server.to(`case:${caseId}`).emit('graph:update', data);
  }

  // Emit system event
  emitSystemEvent(event: string, data: any) {
    this.server.to('global').emit(`system:${event}`, data);
  }

  getConnectedCount(): number {
    return this.connectedClients.size;
  }
}
