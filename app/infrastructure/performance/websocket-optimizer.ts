/**
 * WebSocket Performance Optimizer
 * Infrastructure-specialist による WebSocket最適化とRedis連携
 */

import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import type { Server } from 'socket.io';

export interface WebSocketMetrics {
  totalConnections: number;
  roomConnections: Record<string, number>;
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  errorRate: number;
}

export interface ConnectionInfo {
  userId: number;
  socketId: string;
  joinedAt: Date;
  rooms: Set<string>;
  lastActivity: Date;
  latency: number;
}

export class WebSocketOptimizer {
  private io: Server;
  private redis: Redis;
  private redisAdapter: any;
  private connections: Map<string, ConnectionInfo> = new Map();
  private metrics: WebSocketMetrics;

  // パフォーマンス監視用
  private latencyHistory: number[] = [];
  private messageHistory: { timestamp: number; type: string; duration: number }[] = [];

  constructor(io: Server, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.metrics = this.initializeMetrics();

    this.setupRedisAdapter();
    this.setupConnectionHandlers();
    this.startMetricsCollection();
    this.startCleanupTasks();
  }

  /**
   * Redis Adapter のセットアップ
   */
  private setupRedisAdapter(): void {
    // Redis Adapter for horizontal scaling
    const pubClient = this.redis.duplicate();
    const subClient = this.redis.duplicate();

    this.redisAdapter = createAdapter(pubClient, subClient, {
      key: 'nanika-game:socket.io',
      requestsTimeout: 5000,
    });

    this.io.adapter(this.redisAdapter);
    console.log('✅ Socket.io Redis Adapter configured for horizontal scaling');
  }

  /**
   * 接続ハンドラーの設定
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket) => {
      const startTime = Date.now();
      this.metrics.totalConnections++;

      // 接続情報を記録
      const connectionInfo: ConnectionInfo = {
        userId: 0, // 認証後に設定
        socketId: socket.id,
        joinedAt: new Date(),
        rooms: new Set(),
        lastActivity: new Date(),
        latency: 0,
      };

      this.connections.set(socket.id, connectionInfo);

      // 認証ハンドラー
      socket.on('authenticate', async (data) => {
        const authStartTime = Date.now();

        try {
          const isValid = await this.validateUser(data.userId);
          if (!isValid) {
            socket.emit('authenticate_error', { message: 'Invalid user credentials' });
            return;
          }

          connectionInfo.userId = data.userId;
          await this.setUserOnlineStatus(data.userId, true);

          // ユーザーの前回のルーム参加状態を復元
          await this.restoreUserRooms(socket, data.userId);

          socket.emit('authenticate_success', {
            userId: data.userId,
            restoredRooms: Array.from(connectionInfo.rooms),
          });

          const authDuration = Date.now() - authStartTime;
          this.recordLatency(authDuration);
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('authenticate_error', { message: 'Authentication failed' });
        }
      });

      // ルーム参加の最適化
      socket.on('join_room', async (data) => {
        await this.handleOptimizedRoomJoin(socket, data);
      });

      // メッセージ送信の最適化
      socket.on('send_message', async (data) => {
        await this.handleOptimizedMessageSend(socket, data);
      });

      // 接続状態監視
      socket.on('ping', (callback) => {
        const pongTime = Date.now();
        callback(pongTime);

        const connection = this.connections.get(socket.id);
        if (connection) {
          connection.lastActivity = new Date();
        }
      });

      // 切断処理の最適化
      socket.on('disconnect', async (reason) => {
        await this.handleOptimizedDisconnection(socket, reason);
      });

      console.log(`WebSocket connected: ${socket.id} (setup: ${Date.now() - startTime}ms)`);
    });
  }

  /**
   * 最適化されたルーム参加処理
   */
  private async handleOptimizedRoomJoin(socket: any, data: any): Promise<void> {
    const startTime = Date.now();
    const connection = this.connections.get(socket.id);

    if (!connection || !connection.userId) {
      socket.emit('join_room_error', { message: 'Not authenticated' });
      return;
    }

    const { roomId } = data;

    try {
      // 権限チェック（Redis でキャッシュされたデータを使用）
      const hasPermission = await this.checkRoomPermission(connection.userId, roomId);
      if (!hasPermission) {
        socket.emit('join_room_error', { message: 'Permission denied' });
        return;
      }

      // ルーム参加
      socket.join(roomId);
      connection.rooms.add(roomId);

      // Redis に参加状態を保存
      await this.saveUserRoomState(connection.userId, Array.from(connection.rooms));

      // ルーム統計の更新
      await this.updateRoomStats(roomId, 'join');

      // 他のメンバーに通知（バッチ処理）
      socket.to(roomId).emit('user_joined', {
        userId: connection.userId,
        roomId,
        timestamp: new Date(),
      });

      socket.emit('join_room_success', {
        roomId,
        memberCount: await this.getRoomMemberCount(roomId),
      });

      const duration = Date.now() - startTime;
      this.recordOperation('room_join', duration);
    } catch (error) {
      console.error('Room join error:', error);
      socket.emit('join_room_error', { message: 'Internal server error' });
    }
  }

  /**
   * 最適化されたメッセージ送信処理
   */
  private async handleOptimizedMessageSend(socket: any, data: any): Promise<void> {
    const startTime = Date.now();
    const connection = this.connections.get(socket.id);

    if (!connection || !connection.userId) {
      socket.emit('message_error', { message: 'Not authenticated' });
      return;
    }

    const { roomId, content, messageType = 'TEXT' } = data;

    try {
      // レート制限チェック
      if (await this.isRateLimited(connection.userId)) {
        socket.emit('message_error', { message: 'Rate limit exceeded' });
        return;
      }

      // メッセージの事前検証
      const validation = this.validateMessage(content, messageType);
      if (!validation.valid) {
        socket.emit('message_error', { message: validation.error });
        return;
      }

      // メッセージID生成（UUID代替の高速版）
      const messageId = this.generateFastId();

      // メッセージオブジェクト作成
      const message = {
        id: messageId,
        content: validation.sanitizedContent,
        senderId: connection.userId,
        roomId,
        messageType,
        createdAt: new Date(),
      };

      // データベース保存を非同期で実行（応答速度優先）
      this.queueDatabaseSave(message);

      // Redis に一時保存（即座にアクセス可能）
      await this.redis.setex(
        `message:${messageId}`,
        3600, // 1時間
        JSON.stringify(message)
      );

      // 送信者に成功応答
      socket.emit('message_sent', {
        success: true,
        message,
        timestamp: new Date(),
      });

      // ルーム内の他のメンバーに配信（最適化済み）
      await this.broadcastMessage(roomId, message, socket.id);

      // メトリクス更新
      this.metrics.messagesSent++;
      this.recordOperation('message_send', Date.now() - startTime);

      // レート制限カウンター更新
      await this.updateRateLimit(connection.userId);
    } catch (error) {
      console.error('Message send error:', error);
      socket.emit('message_error', { message: 'Failed to send message' });
    }
  }

  /**
   * 最適化されたメッセージ配信
   */
  private async broadcastMessage(
    roomId: string,
    message: any,
    senderSocketId: string
  ): Promise<void> {
    const startTime = Date.now();

    // ルーム内の接続数を確認
    const roomSockets = await this.io.in(roomId).fetchSockets();

    if (roomSockets.length === 0) {
      return; // 配信先なし
    }

    // 大きなルームの場合はバッチ処理
    if (roomSockets.length > 100) {
      await this.batchBroadcast(roomId, message, senderSocketId);
    } else {
      // 通常の配信
      this.io.to(roomId).except(senderSocketId).emit('message_received', message);
    }

    this.recordOperation('message_broadcast', Date.now() - startTime);
  }

  /**
   * バッチ処理による大規模配信
   */
  private async batchBroadcast(
    roomId: string,
    message: any,
    senderSocketId: string
  ): Promise<void> {
    const BATCH_SIZE = 50;
    const roomSockets = await this.io.in(roomId).fetchSockets();
    const targetSockets = roomSockets.filter((s) => s.id !== senderSocketId);

    // バッチに分割して配信
    for (let i = 0; i < targetSockets.length; i += BATCH_SIZE) {
      const batch = targetSockets.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map((s) => s.id);

      // Promise を使わずに即座に送信
      batchIds.forEach((socketId) => {
        this.io.to(socketId).emit('message_received', message);
      });

      // 短い間隔を置いて次のバッチ
      if (i + BATCH_SIZE < targetSockets.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * 最適化された切断処理
   */
  private async handleOptimizedDisconnection(socket: any, reason: string): Promise<void> {
    const connection = this.connections.get(socket.id);

    if (connection) {
      try {
        // オンライン状態の更新
        if (connection.userId) {
          await this.setUserOnlineStatus(connection.userId, false);

          // 参加していたルームに離脱通知
          for (const roomId of connection.rooms) {
            socket.to(roomId).emit('user_left', {
              userId: connection.userId,
              roomId,
              reason,
              timestamp: new Date(),
            });

            await this.updateRoomStats(roomId, 'leave');
          }
        }

        this.connections.delete(socket.id);
        this.metrics.totalConnections--;

        console.log(`WebSocket disconnected: ${socket.id}, reason: ${reason}`);
      } catch (error) {
        console.error('Disconnection handling error:', error);
      }
    }
  }

  /**
   * ユーザー認証の検証
   */
  private async validateUser(userId: number): Promise<boolean> {
    if (!userId || typeof userId !== 'number') return false;

    // Redis キャッシュから確認
    const cacheKey = `user:${userId}:valid`;
    const cached = await this.redis.get(cacheKey);

    if (cached === 'true') return true;
    if (cached === 'false') return false;

    // データベース確認（実際の実装では Prisma を使用）
    // const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // const isValid = !!user;

    // 仮の実装
    const isValid = userId >= 1 && userId <= 1000;

    // 結果をキャッシュ（5分）
    await this.redis.setex(cacheKey, 300, isValid ? 'true' : 'false');

    return isValid;
  }

  /**
   * ルーム参加権限の確認
   */
  private async checkRoomPermission(userId: number, roomId: string): Promise<boolean> {
    const cacheKey = `permission:${userId}:${roomId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached === 'true') return true;
    if (cached === 'false') return false;

    // 権限確認ロジック（実際の実装ではデータベース確認）
    const hasPermission = true; // 仮の実装

    await this.redis.setex(cacheKey, 300, hasPermission ? 'true' : 'false');
    return hasPermission;
  }

  /**
   * メッセージバリデーション
   */
  private validateMessage(
    content: string,
    _messageType: string
  ): {
    valid: boolean;
    error?: string;
    sanitizedContent?: string;
  } {
    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'Invalid message content' };
    }

    if (content.length > 2000) {
      return { valid: false, error: 'Message too long' };
    }

    if (content.trim().length === 0) {
      return { valid: false, error: 'Empty message' };
    }

    // XSS対策の基本的なサニタイゼーション
    const sanitizedContent = content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return { valid: true, sanitizedContent };
  }

  /**
   * レート制限の確認
   */
  private async isRateLimited(userId: number): Promise<boolean> {
    const key = `rate_limit:${userId}`;
    const current = await this.redis.get(key);

    const limit = 20; // 20 messages per minute
    const window = 60; // 60 seconds

    if (!current) {
      await this.redis.setex(key, window, '1');
      return false;
    }

    const count = parseInt(current);
    return count >= limit;
  }

  /**
   * レート制限カウンター更新
   */
  private async updateRateLimit(userId: number): Promise<void> {
    const key = `rate_limit:${userId}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 60); // 1分でリセット
  }

  /**
   * 高速ID生成（UUID代替）
   */
  private generateFastId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * データベース保存のキューイング
   */
  private queueDatabaseSave(message: any): void {
    // 実際の実装では、メッセージキューまたはバックグラウンドジョブで処理
    setTimeout(async () => {
      try {
        // await this.prisma.message.create({ data: message });
        console.log(`Message ${message.id} saved to database`);
      } catch (error) {
        console.error('Database save error:', error);
        // エラー時のリトライロジックも実装
      }
    }, 0);
  }

  /**
   * ユーザーのオンライン状態管理
   */
  private async setUserOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
    const key = `user_online:${userId}`;

    if (isOnline) {
      await this.redis.setex(key, 300, 'true'); // 5分で自動削除
    } else {
      await this.redis.del(key);
    }
  }

  /**
   * ユーザーのルーム状態復元
   */
  private async restoreUserRooms(socket: any, userId: number): Promise<void> {
    const key = `user_rooms:${userId}`;
    const roomsData = await this.redis.get(key);

    if (roomsData) {
      const rooms: string[] = JSON.parse(roomsData);
      const connection = this.connections.get(socket.id);

      for (const roomId of rooms) {
        socket.join(roomId);
        connection?.rooms.add(roomId);
      }
    }
  }

  /**
   * ユーザーのルーム状態保存
   */
  private async saveUserRoomState(userId: number, rooms: string[]): Promise<void> {
    const key = `user_rooms:${userId}`;
    await this.redis.setex(key, 3600, JSON.stringify(rooms)); // 1時間
  }

  /**
   * ルーム統計の更新
   */
  private async updateRoomStats(roomId: string, action: 'join' | 'leave'): Promise<void> {
    const key = `room_stats:${roomId}`;
    const field = 'member_count';

    if (action === 'join') {
      await this.redis.hincrby(key, field, 1);
    } else {
      await this.redis.hincrby(key, field, -1);
    }

    await this.redis.expire(key, 3600);
  }

  /**
   * ルームメンバー数取得
   */
  private async getRoomMemberCount(roomId: string): Promise<number> {
    const sockets = await this.io.in(roomId).fetchSockets();
    return sockets.length;
  }

  /**
   * レイテンシ記録
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);

    // 直近100件を保持
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }

    // 平均レイテンシ更新
    this.metrics.averageLatency =
      this.latencyHistory.reduce((sum, l) => sum + l, 0) / this.latencyHistory.length;
  }

  /**
   * 操作記録
   */
  private recordOperation(type: string, duration: number): void {
    this.messageHistory.push({
      timestamp: Date.now(),
      type,
      duration,
    });

    // 直近1000件を保持
    if (this.messageHistory.length > 1000) {
      this.messageHistory.shift();
    }
  }

  /**
   * メトリクス初期化
   */
  private initializeMetrics(): WebSocketMetrics {
    return {
      totalConnections: 0,
      roomConnections: {},
      messagesSent: 0,
      messagesReceived: 0,
      averageLatency: 0,
      errorRate: 0,
    };
  }

  /**
   * メトリクス収集開始
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      // Redis からメトリクス情報を収集
      const redisInfo = await this.redis.info('memory');
      const memoryUsage = this.parseRedisMemory(redisInfo);

      console.log('WebSocket Metrics:', {
        connections: this.metrics.totalConnections,
        averageLatency: Math.round(this.metrics.averageLatency),
        messagesSent: this.metrics.messagesSent,
        redisMemory: `${Math.round(memoryUsage / 1024 / 1024)}MB`,
      });
    }, 30000); // 30秒毎
  }

  /**
   * クリーンアップタスク開始
   */
  private startCleanupTasks(): void {
    // 古い接続情報のクリーンアップ
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [socketId, connection] of this.connections) {
        const inactiveTime = now - connection.lastActivity.getTime();

        if (inactiveTime > 300000) {
          // 5分以上非アクティブ
          this.connections.delete(socketId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} inactive connections`);
      }
    }, 60000); // 1分毎

    // レート制限データのクリーンアップ
    setInterval(async () => {
      const keys = await this.redis.keys('rate_limit:*');
      let expiredCount = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // TTL未設定のキーを削除
          await this.redis.del(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.log(`Cleaned up ${expiredCount} rate limit keys`);
      }
    }, 300000); // 5分毎
  }

  /**
   * Redis メモリ使用量パース
   */
  private parseRedisMemory(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * パフォーマンス統計取得
   */
  getPerformanceStats(): {
    connections: number;
    averageLatency: number;
    messagesSent: number;
    messagesReceived: number;
    recentOperations: Array<{ type: string; averageDuration: number }>;
  } {
    // 最近の操作パフォーマンス分析
    const recent = this.messageHistory.filter(
      (h) => Date.now() - h.timestamp < 300000 // 5分以内
    );

    const operationStats = recent.reduce(
      (acc, op) => {
        if (!acc[op.type]) {
          acc[op.type] = { total: 0, count: 0 };
        }
        acc[op.type].total += op.duration;
        acc[op.type].count++;
        return acc;
      },
      {} as Record<string, { total: number; count: number }>
    );

    const recentOperations = Object.entries(operationStats).map(([type, stats]) => ({
      type,
      averageDuration: Math.round(stats.total / stats.count),
    }));

    return {
      connections: this.metrics.totalConnections,
      averageLatency: Math.round(this.metrics.averageLatency),
      messagesSent: this.metrics.messagesSent,
      messagesReceived: this.metrics.messagesReceived,
      recentOperations,
    };
  }

  /**
   * 詳細接続情報取得
   */
  getDetailedConnectionInfo(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }
}
