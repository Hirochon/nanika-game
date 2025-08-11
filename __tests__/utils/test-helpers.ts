/**
 * Test Helpers - チャット機能統合テスト用ユーティリティ
 * Infrastructure-specialist による統合テスト基盤
 */

import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import { type Socket as ClientSocket, io as ioClient } from 'socket.io-client';

export interface TestUser {
  id: number;
  email: string;
  name: string;
  password: string;
}

export interface TestChatRoom {
  id: number;
  name: string;
  type: 'DIRECT' | 'GROUP';
}

export interface TestMessage {
  id: string;
  content: string;
  senderId: number;
  roomId: string;
}

export class IntegrationTestHelper {
  private prisma: PrismaClient;
  private redis: Redis;
  private testUsers: TestUser[] = [];
  private testChatRooms: TestChatRoom[] = [];
  private testMessages: TestMessage[] = [];
  private testServers: ReturnType<typeof createServer>[] = [];

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        },
      },
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15, // Use database 15 for testing
    });
  }

  /**
   * テスト環境のセットアップ
   */
  async setup(): Promise<void> {
    // データベースのクリーンアップ
    await this.cleanupDatabase();

    // Redisのクリーンアップ
    await this.cleanupRedis();

    // テストデータの作成
    await this.createTestUsers();
    await this.createTestChatRooms();
  }

  /**
   * テスト環境のクリーンアップ
   */
  async cleanup(): Promise<void> {
    // Clean up test servers
    for (const server of this.testServers) {
      if (server?.close) {
        server.close();
      }
    }
    this.testServers = [];

    await this.cleanupDatabase();
    await this.cleanupRedis();
    await this.prisma.$disconnect();
    await this.redis.quit();
  }

  /**
   * データベースのクリーンアップ
   */
  private async cleanupDatabase(): Promise<void> {
    // テーブルの順序を考慮してデータを削除
    await this.prisma.message.deleteMany();
    await this.prisma.chatMember.deleteMany();
    await this.prisma.chatRoom.deleteMany();
    await this.prisma.session.deleteMany();
    await this.prisma.user.deleteMany();

    this.testUsers = [];
    this.testChatRooms = [];
    this.testMessages = [];
  }

  /**
   * Redisのクリーンアップ
   */
  private async cleanupRedis(): Promise<void> {
    await this.redis.flushdb();
  }

  /**
   * テストユーザーの作成
   */
  private async createTestUsers(): Promise<void> {
    const bcrypt = await import('bcrypt');

    const users = [
      { email: 'test1@example.com', name: 'Test User 1', password: 'password123' },
      { email: 'test2@example.com', name: 'Test User 2', password: 'password123' },
      { email: 'test3@example.com', name: 'Test User 3', password: 'password123' },
    ];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // upsertを使用して重複エラーを回避
      const user = await this.prisma.user.upsert({
        where: { email: userData.email },
        update: {
          name: userData.name,
          passwordHash: hashedPassword,
        },
        create: {
          email: userData.email,
          name: userData.name,
          passwordHash: hashedPassword,
        },
      });

      this.testUsers.push({
        id: user.id,
        email: user.email,
        name: user.name,
        password: userData.password, // 平文パスワードを保存（テスト用）
      });
    }
  }

  /**
   * テストチャットルームの作成
   */
  private async createTestChatRooms(): Promise<void> {
    if (this.testUsers.length < 2) {
      throw new Error('Need at least 2 test users to create chat rooms');
    }

    // 1対1チャットルーム (DIRECTタイプを使用)
    const oneOnOneRoom = await this.prisma.chatRoom.create({
      data: {
        name: 'Test One-on-One Chat',
        type: 'DIRECT',
        members: {
          create: [
            { userId: this.testUsers[0].id, role: 'ADMIN' },
            { userId: this.testUsers[1].id, role: 'MEMBER' },
          ],
        },
      },
    });

    this.testChatRooms.push({
      id: oneOnOneRoom.id,
      name: oneOnOneRoom.name || 'Test One-on-One Chat',
      type: oneOnOneRoom.type as 'DIRECT' | 'GROUP',
    });

    // グループチャットルーム
    if (this.testUsers.length >= 3) {
      const groupRoom = await this.prisma.chatRoom.create({
        data: {
          name: 'Test Group Chat',
          type: 'GROUP',
          members: {
            create: [
              { userId: this.testUsers[0].id, role: 'ADMIN' },
              { userId: this.testUsers[1].id, role: 'MEMBER' },
              { userId: this.testUsers[2].id, role: 'MEMBER' },
            ],
          },
        },
      });

      this.testChatRooms.push({
        id: groupRoom.id,
        name: groupRoom.name || 'Test Group Chat',
        type: groupRoom.type as 'DIRECT' | 'GROUP',
      });
    }
  }

  /**
   * WebSocketサーバーの作成
   */
  async createTestSocketServer(port: number = 0): Promise<{
    server: ReturnType<typeof createServer>;
    socketServer: Server;
    port: number;
  }> {
    const httpServer = createServer();
    const socketServer = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    return new Promise((resolve) => {
      httpServer.listen(port, () => {
        const address = httpServer.address();
        const actualPort =
          address && typeof address === 'object' && 'port' in address ? address.port : port;
        resolve({
          server: httpServer,
          socketServer,
          port: actualPort,
        });
      });
    });
  }

  /**
   * テストサーバーの起動（HTTP + WebSocket）
   */
  async startTestServer(): Promise<number> {
    const { createServer } = await import('node:http');
    const { Server: SocketServer } = await import('socket.io');

    // Create HTTP server with our test endpoints
    const server = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
          })
        );
        return;
      }

      if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'OK',
            service: 'nanika-game-api',
            version: '1.0.0',
          })
        );
        return;
      }

      if (req.url === '/api/chat/rooms') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            data: [
              { id: 'room1', name: 'General Chat', memberCount: 5 },
              { id: 'room2', name: 'Game Discussion', memberCount: 12 },
            ],
          })
        );
        return;
      }

      // Default 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    // Setup WebSocket
    const io = new SocketServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // WebSocket connection handling
    io.on('connection', (socket) => {
      console.log(`Test WebSocket client connected: ${socket.id}`);

      socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', { userId: socket.id });
        console.log(`Test socket ${socket.id} joined room ${roomId}`);
      });

      socket.on('send-message', (data) => {
        const { roomId, message, userId } = data;
        if (roomId && message && userId) {
          socket.to(roomId).emit('new-message', {
            id: Date.now(),
            content: message,
            userId,
            timestamp: new Date().toISOString(),
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`Test WebSocket client disconnected: ${socket.id}`);
      });
    });

    return new Promise((resolve) => {
      const testServer = server.listen(0, () => {
        const address = testServer.address();
        const port = address && typeof address === 'object' && 'port' in address ? address.port : 0;
        console.log(`Test server started on port ${port}`);
        this.testServers.push(testServer);
        resolve(port);
      });
    });
  }

  /**
   * HTTPリクエストの実行
   */
  async makeHttpRequest(
    url: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    data: unknown;
  }> {
    const fetch = (await import('node-fetch')).default;

    const config = {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    return {
      status: response.status,
      headers: response.headers.raw() as Record<string, string>,
      data,
    };
  }

  /**
   * WebSocketクライアントの作成
   */
  createTestSocketClient(port: number, _userId: number): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        // Simple connection without authentication for testing
        resolve(client);
      });

      client.on('connect_error', (error) => {
        reject(error);
      });

      // タイムアウト設定
      setTimeout(() => {
        if (!client.connected) {
          client.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * テストメッセージの送信
   */
  async sendTestMessage(
    client: ClientSocket,
    roomId: string,
    content: string,
    senderId: number
  ): Promise<TestMessage> {
    return new Promise((resolve, reject) => {
      const messageData = { roomId, content, senderId };

      client.emit('send_message', messageData);

      client.on('message_sent', (response) => {
        if (response.success) {
          const message: TestMessage = {
            id: response.message.id,
            content: response.message.content,
            senderId: response.message.senderId,
            roomId: response.message.roomId,
          };

          this.testMessages.push(message);
          resolve(message);
        } else {
          reject(new Error(`Failed to send message: ${response.error}`));
        }
      });

      // タイムアウト設定
      setTimeout(() => {
        reject(new Error('Message send timeout'));
      }, 3000);
    });
  }

  /**
   * チャットルーム参加
   */
  async joinTestRoom(client: ClientSocket, roomId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      client.emit('join_room', { roomId });

      client.on('join_room_success', () => {
        resolve(true);
      });

      client.on('join_room_error', (error) => {
        reject(new Error(`Failed to join room: ${error.message}`));
      });

      // タイムアウト設定
      setTimeout(() => {
        reject(new Error('Room join timeout'));
      }, 3000);
    });
  }

  /**
   * メッセージ受信の待機
   */
  waitForMessage(
    client: ClientSocket,
    expectedContent?: string,
    timeout: number = 3000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const messageHandler = (message: { content?: string }) => {
        if (!expectedContent || message.content === expectedContent) {
          client.off('message_received', messageHandler);
          resolve(message);
        }
      };

      client.on('message_received', messageHandler);

      // タイムアウト設定
      setTimeout(() => {
        client.off('message_received', messageHandler);
        reject(
          new Error(
            `Message receive timeout${expectedContent ? ` for content: ${expectedContent}` : ''}`
          )
        );
      }, timeout);
    });
  }

  /**
   * 複数のWebSocketクライアント接続の作成
   */
  async createMultipleClients(port: number, userIds: number[]): Promise<ClientSocket[]> {
    const clients = await Promise.all(
      userIds.map((userId) => this.createTestSocketClient(port, userId))
    );
    return clients;
  }

  /**
   * 全クライアントの切断
   */
  disconnectClients(clients: ClientSocket[]): void {
    clients.forEach((client) => {
      if (client.connected) {
        client.disconnect();
      }
    });
  }

  /**
   * データベース状態の確認
   */
  async verifyDatabaseState(): Promise<{
    users: number;
    chatRooms: number;
    messages: number;
    chatMembers: number;
  }> {
    const [users, chatRooms, messages, chatMembers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.chatRoom.count(),
      this.prisma.message.count(),
      this.prisma.chatMember.count(),
    ]);

    return { users, chatRooms, messages, chatMembers };
  }

  /**
   * Redisセッション状態の確認
   */
  async verifyRedisState(): Promise<{
    activeConnections: number;
    sessionKeys: number;
  }> {
    const keys = await this.redis.keys('*');
    const sessionKeys = keys.filter((key) => key.includes('session')).length;
    const connectionKeys = keys.filter((key) => key.includes('socket')).length;

    return {
      activeConnections: connectionKeys,
      sessionKeys,
    };
  }

  // Getter methods for test data
  get users(): TestUser[] {
    return [...this.testUsers];
  }

  get chatRooms(): TestChatRoom[] {
    return [...this.testChatRooms];
  }

  get messages(): TestMessage[] {
    return [...this.testMessages];
  }

  get database(): PrismaClient {
    return this.prisma;
  }

  get redisClient(): Redis {
    return this.redis;
  }
}

/**
 * パフォーマンステスト用ヘルパー
 */
export class PerformanceTestHelper {
  /**
   * 応答時間の測定
   */
  static async measureResponseTime<T>(fn: () => Promise<T>): Promise<{
    result: T;
    duration: number;
  }> {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

    return { result, duration };
  }

  /**
   * 同時実行のテスト
   */
  static async measureConcurrentOperations<T>(
    operations: (() => Promise<T>)[],
    concurrency: number = 10
  ): Promise<{
    results: T[];
    totalDuration: number;
    averageDuration: number;
    successRate: number;
  }> {
    const startTime = process.hrtime.bigint();
    const chunks = PerformanceTestHelper.chunkArray(operations, concurrency);
    const results: T[] = [];
    let successCount = 0;

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(chunk.map((op) => op()));

      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          successCount++;
        }
      }
    }

    const endTime = process.hrtime.bigint();
    const totalDuration = Number(endTime - startTime) / 1_000_000;
    const averageDuration = totalDuration / operations.length;
    const successRate = successCount / operations.length;

    return {
      results,
      totalDuration,
      averageDuration,
      successRate,
    };
  }

  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * アサーション用ヘルパー
 */
export class TestAssertions {
  static expectWithinRange(actual: number, expected: number, tolerance: number): void {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Expected ${actual} to be within ${tolerance} of ${expected}`);
    }
  }

  static expectResponseTime(duration: number, maxMs: number): void {
    if (duration > maxMs) {
      throw new Error(`Response time ${duration}ms exceeds maximum ${maxMs}ms`);
    }
  }

  static expectSuccessRate(rate: number, minRate: number): void {
    if (rate < minRate) {
      throw new Error(
        `Success rate ${(rate * 100).toFixed(1)}% is below minimum ${(minRate * 100).toFixed(1)}%`
      );
    }
  }
}
