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
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(WebSocketGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }) {
    if (data?.room) {
      client.join(data.room);
      this.logger.log(`Client ${client.id} joined room: ${data.room}`);
    }
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }) {
    if (data?.room) {
      client.leave(data.room);
    }
  }

  emitStageUpdate(investigationId: string, data: any) {
    this.server.to(`investigation:${investigationId}`).emit('investigation:stage-update', data);
  }

  emitInvestigationAlert(investigationId: string, data: any) {
    this.server.to(`investigation:${investigationId}`).emit('investigation:alert', data);
  }

  emitInvestigationCompleted(investigationId: string, data: any) {
    this.server.to(`investigation:${investigationId}`).emit('investigation:completed', data);
  }

  emitInvestigationFailed(investigationId: string, data: any) {
    this.server.to(`investigation:${investigationId}`).emit('investigation:failed', data);
  }

  emitGlobalAlert(data: any) {
    this.server.to('global:alert').emit('global:alert', data);
  }

  emitGlobalActivity(data: any) {
    this.server.to('global:activity').emit('global:activity', data);
  }
}
