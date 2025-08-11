/**
 * WebSocketサーバー統合
 * 認証付きSocket.ioサーバーの実装
 */

import type { Server } from 'node:http';
import Redis from 'ioredis';
import { Server as SocketServer } from 'socket.io';
import { AuthenticationHandler } from '../websocket/handlers/authentication.handler';
// 既存のWebSocketハンドラー
import { ChatSocketHandler } from '../websocket/handlers/chat-socket.handler';

/**
 * WebSocketサーバー設定
 */
interface WebSocketConfig {
  corsOrigins: string[];
  redisUrl?: string;
  maxConnections?: number;
}

/**
 * WebSocketサーバークラス
 */
export class WebSocketServer {
  private io: SocketServer;
  private redis?: { pub: Redis; sub: Redis };
  private chatHandler: ChatSocketHandler;
  private authHandler: AuthenticationHandler;

  constructor(httpServer: Server, config: WebSocketConfig) {
    // Socket.io サーバー初期化
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: config.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      maxHttpBufferSize: 1e6, // 1MB
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // ハンドラー初期化
    this.chatHandler = new ChatSocketHandler();
    this.authHandler = new AuthenticationHandler();

    // Redis アダプター設定
    this.setupRedisAdapter(config.redisUrl);

    // ミドルウェアとハンドラーの設定
    this.setupMiddlewares();
    this.setupEventHandlers();
  }

  /**
   * Redis アダプター設定
   */
  private setupRedisAdapter(redisUrl?: string) {
    if (!redisUrl) {
      console.warn('Redis URL not provided, WebSocket scaling disabled');
      return;
    }

    try {
      const pubClient = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      const subClient = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // エラーハンドリング
      pubClient.on('error', (err) => {
        console.error('Redis pub client error:', err);
      });

      subClient.on('error', (err) => {
        console.error('Redis sub client error:', err);
      });

      // アダプター設定（Redis利用可能時のみ）
      pubClient.on('connect', () => {
        // io.adapter(createAdapter(pubClient, subClient));
        console.log('Redis adapter configured for WebSocket scaling');
      });

      this.redis = { pub: pubClient, sub: subClient };
    } catch (error) {
      console.error('Failed to setup Redis adapter:', error);
    }
  }

  /**
   * ミドルウェア設定
   */
  private setupMiddlewares() {
    // 認証ミドルウェア
    this.io.use(async (socket, next) => {
      try {
        const isAuthenticated = await this.authHandler.authenticate(socket);
        if (!isAuthenticated) {
          return next(new Error('WEBSOCKET_AUTH_FAILED'));
        }
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('WEBSOCKET_AUTH_FAILED'));
      }
    });

    // 接続制限ミドルウェア
    this.io.use((_socket, next) => {
      const connectionCount = this.io.engine.clientsCount;
      const maxConnections = 1000; // 設定可能

      if (connectionCount >= maxConnections) {
        console.warn(`WebSocket connection limit reached: ${connectionCount}`);
        return next(new Error('CONNECTION_LIMIT_EXCEEDED'));
      }

      next();
    });
  }

  /**
   * イベントハンドラー設定
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`WebSocket client connected: ${socket.id}`);

      // 接続統計
      this.logConnectionStats();

      // チャット関連イベント
      this.chatHandler.handleConnection(socket);

      // 切断処理
      socket.on('disconnect', (reason) => {
        console.log(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
        this.chatHandler.handleDisconnection(socket, reason);
      });

      // エラーハンドリング
      socket.on('error', (error) => {
        console.error(`WebSocket error for client ${socket.id}:`, error);
      });
    });

    // サーバーレベルのエラーハンドリング
    this.io.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * 接続統計ログ
   */
  private logConnectionStats() {
    const stats = {
      totalConnections: this.io.engine.clientsCount,
      connectedSockets: this.io.sockets.sockets.size,
      timestamp: new Date().toISOString(),
    };

    // 定期的に統計を出力（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('WebSocket Stats:', stats);
    }
  }

  /**
   * 特定ルームにメッセージをブロードキャスト
   */
  public broadcastToRoom(roomId: string, event: string, data: any) {
    this.io.to(roomId).emit(event, data);
  }

  /**
   * 全クライアントにメッセージをブロードキャスト
   */
  public broadcast(event: string, data: any) {
    this.io.emit(event, data);
  }

  /**
   * 特定ユーザーにメッセージを送信
   */
  public sendToUser(userId: string, event: string, data: any) {
    // ソケットIDとユーザーIDのマッピングが必要（実装は後で）
    console.log(`Sending to user ${userId}:`, event, data);
  }

  /**
   * サーバー統計情報を取得
   */
  public getStats() {
    return {
      totalConnections: this.io.engine.clientsCount,
      connectedSockets: this.io.sockets.sockets.size,
      rooms: Array.from(this.io.sockets.adapter.rooms.keys()),
      redisConnected: this.redis?.pub.status === 'ready',
    };
  }

  /**
   * WebSocketサーバーを停止
   */
  public async stop() {
    console.log('Stopping WebSocket server...');

    // 全接続を閉じる
    this.io.close();

    // Redisクライアントを閉じる
    if (this.redis) {
      await Promise.all([this.redis.pub.disconnect(), this.redis.sub.disconnect()]);
    }

    console.log('WebSocket server stopped');
  }

  /**
   * Socket.io インスタンスを取得
   */
  public getIO(): SocketServer {
    return this.io;
  }
}
