import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { container, TOKENS } from '../infrastructure/config/container';
import { AuthenticationHandler } from './handlers/authentication.handler';
import { ChatSocketHandler } from './handlers/chat-socket.handler';

export class SocketServer {
  private io: SocketIOServer;
  private authHandler: AuthenticationHandler;
  private chatHandler: ChatSocketHandler;

  constructor(httpServer: HttpServer) {
    // Socket.ioサーバーの初期化
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // ハンドラーの初期化
    this.authHandler = new AuthenticationHandler();
    this.chatHandler = new ChatSocketHandler(
      container.resolve(TOKENS.ChatRoomRepository),
      container.resolve(TOKENS.MessageRepository),
      container.resolve(TOKENS.SendMessageUseCase)
    );

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // 認証ミドルウェア
    this.io.use(async (socket, next) => {
      try {
        const sessionToken =
          socket.handshake.auth.sessionToken ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!sessionToken) {
          return next(new Error('Authentication required'));
        }

        const user = await this.authHandler.authenticateSocket(sessionToken);
        if (!user) {
          return next(new Error('Invalid session'));
        }

        // ソケットにユーザー情報を付与
        socket.data.userId = user.id;
        socket.data.userName = user.name;
        socket.data.sessionToken = sessionToken;

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      const userName = socket.data.userName;

      console.log(`User ${userName} (${userId}) connected: ${socket.id}`);

      // 認証成功イベント
      socket.emit('authenticate_success', {
        userId,
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
      });

      // チャット関連イベントの設定
      this.setupChatEvents(socket);

      // 切断時の処理
      socket.on('disconnect', (reason) => {
        console.log(`User ${userName} (${userId}) disconnected: ${reason}`);

        // ユーザーが参加していた全ルームから離脱通知
        this.chatHandler.handleUserDisconnected(socket, this.io);
      });

      // エラーハンドリング
      socket.on('error', (error) => {
        console.error(`Socket error for user ${userId}:`, error);
        socket.emit('error', {
          code: 'SOCKET_ERROR',
          message: 'Internal server error occurred',
        });
      });
    });
  }

  private setupChatEvents(socket: any): void {
    const _userId = socket.data.userId;

    // ルーム参加
    socket.on('join_room', async (data: { roomId: number }) => {
      try {
        await this.chatHandler.handleJoinRoom(socket, data, this.io);
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('error', {
          code: 'JOIN_ROOM_ERROR',
          message: error instanceof Error ? error.message : 'Failed to join room',
        });
      }
    });

    // ルーム退出
    socket.on('leave_room', async (data: { roomId: number }) => {
      try {
        await this.chatHandler.handleLeaveRoom(socket, data, this.io);
      } catch (error) {
        console.error('Leave room error:', error);
        socket.emit('error', {
          code: 'LEAVE_ROOM_ERROR',
          message: error instanceof Error ? error.message : 'Failed to leave room',
        });
      }
    });

    // メッセージ送信
    socket.on(
      'send_message',
      async (data: {
        roomId: number;
        content: string;
        messageType?: 'TEXT' | 'IMAGE' | 'FILE';
        tempId?: string;
      }) => {
        try {
          await this.chatHandler.handleSendMessage(socket, data, this.io);
        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', {
            code: 'SEND_MESSAGE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to send message',
          });
        }
      }
    );

    // メッセージ編集
    socket.on(
      'edit_message',
      async (data: { roomId: number; messageId: number; content: string }) => {
        try {
          await this.chatHandler.handleEditMessage(socket, data, this.io);
        } catch (error) {
          console.error('Edit message error:', error);
          socket.emit('error', {
            code: 'EDIT_MESSAGE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to edit message',
          });
        }
      }
    );

    // メッセージ削除
    socket.on('delete_message', async (data: { roomId: number; messageId: number }) => {
      try {
        await this.chatHandler.handleDeleteMessage(socket, data, this.io);
      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', {
          code: 'DELETE_MESSAGE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete message',
        });
      }
    });

    // タイピング開始 (Phase 2)
    socket.on('typing_start', async (data: { roomId: number }) => {
      try {
        await this.chatHandler.handleTypingStart(socket, data, this.io);
      } catch (error) {
        console.error('Typing start error:', error);
      }
    });

    // タイピング停止 (Phase 2)
    socket.on('typing_stop', async (data: { roomId: number }) => {
      try {
        await this.chatHandler.handleTypingStop(socket, data, this.io);
      } catch (error) {
        console.error('Typing stop error:', error);
      }
    });

    // 既読マーク (Phase 2)
    socket.on('mark_as_read', async (data: { roomId: number; messageId: number }) => {
      try {
        await this.chatHandler.handleMarkAsRead(socket, data, this.io);
      } catch (error) {
        console.error('Mark as read error:', error);
      }
    });
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public close(): void {
    this.io.close();
  }
}
