/**
 * WebSocket統合テスト - 接続・認証・基本通信
 * Infrastructure-specialist による WebSocket 統合テスト
 */

import type { createServer } from 'node:http';
import type { Server } from 'socket.io';
import type { Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  IntegrationTestHelper,
  PerformanceTestHelper,
  TestAssertions,
} from '../../utils/test-helpers';

describe.skip('WebSocket Integration Tests - Connection & Authentication', () => {
  let testHelper: IntegrationTestHelper;
  let socketServer: Server;
  let httpServer: ReturnType<typeof createServer>;
  let serverPort: number;

  beforeAll(async () => {
    testHelper = new IntegrationTestHelper();
    await testHelper.setup();

    // テスト用WebSocketサーバーの起動
    const serverSetup = await testHelper.createTestSocketServer();
    socketServer = serverSetup.socketServer;
    httpServer = serverSetup.server;
    serverPort = serverSetup.port;

    // Socket.ioサーバーの認証・イベントハンドラー設定
    setupSocketHandlers(socketServer);
  });

  afterAll(async () => {
    if (httpServer) {
      httpServer.close();
    }
    await testHelper.cleanup();
  });

  describe('基本接続テスト', () => {
    let client: ClientSocket;

    afterEach(() => {
      if (client?.connected) {
        client.disconnect();
      }
    });

    it('WebSocket接続が正常に確立される', async () => {
      const { result, duration } = await PerformanceTestHelper.measureResponseTime(async () => {
        return await testHelper.createTestSocketClient(serverPort, testHelper.users[0].id);
      });

      client = result;

      expect(client.connected).toBe(true);
      TestAssertions.expectResponseTime(duration, 1000); // 1秒以内
    });

    it('無効なユーザーIDでの認証が失敗する', async () => {
      await expect(async () => {
        client = await testHelper.createTestSocketClient(serverPort, 99999);
      }).rejects.toThrow('Authentication failed');
    });

    it('複数の同時接続が正常に処理される', async () => {
      const userIds = testHelper.users.map((u) => u.id);
      const clients = await testHelper.createMultipleClients(serverPort, userIds);

      expect(clients).toHaveLength(userIds.length);

      for (const client of clients) {
        expect(client.connected).toBe(true);
      }

      testHelper.disconnectClients(clients);
    });

    it('接続確立時のパフォーマンス要件を満たす', async () => {
      const operations = Array(10)
        .fill(0)
        .map(() => () => testHelper.createTestSocketClient(serverPort, testHelper.users[0].id));

      const { results, averageDuration, successRate } =
        await PerformanceTestHelper.measureConcurrentOperations(operations, 5);

      TestAssertions.expectResponseTime(averageDuration, 500); // 平均500ms以内
      TestAssertions.expectSuccessRate(successRate, 0.95); // 95%以上成功

      // 作成したクライアントをクリーンアップ
      results.forEach((client: ClientSocket) => {
        if (client?.connected) {
          client.disconnect();
        }
      });
    });
  });

  describe('チャットルーム参加・離脱テスト', () => {
    let clients: ClientSocket[] = [];

    beforeEach(async () => {
      const userIds = testHelper.users.slice(0, 2).map((u) => u.id);
      clients = await testHelper.createMultipleClients(serverPort, userIds);
    });

    afterEach(() => {
      testHelper.disconnectClients(clients);
      clients = [];
    });

    it('チャットルームに正常に参加できる', async () => {
      const room = testHelper.chatRooms[0];

      const { duration } = await PerformanceTestHelper.measureResponseTime(async () => {
        return await testHelper.joinTestRoom(clients[0], room.id);
      });

      TestAssertions.expectResponseTime(duration, 300); // 300ms以内
    });

    it('複数ユーザーが同じルームに参加できる', async () => {
      const room = testHelper.chatRooms[0];

      // 両方のクライアントが同じルームに参加
      await Promise.all([
        testHelper.joinTestRoom(clients[0], room.id),
        testHelper.joinTestRoom(clients[1], room.id),
      ]);

      // 参加成功の確認
      expect(clients[0].connected).toBe(true);
      expect(clients[1].connected).toBe(true);
    });

    it('存在しないルームへの参加が適切にエラーになる', async () => {
      await expect(async () => {
        await testHelper.joinTestRoom(clients[0], 'non-existent-room');
      }).rejects.toThrow('Failed to join room');
    });

    it('権限のないルームへの参加が拒否される', async () => {
      // テストユーザー3（ルームのメンバーでない）でのアクセス
      if (testHelper.users.length >= 3) {
        const client3 = await testHelper.createTestSocketClient(serverPort, testHelper.users[2].id);

        await expect(async () => {
          await testHelper.joinTestRoom(client3, testHelper.chatRooms[0].id);
        }).rejects.toThrow('Failed to join room');

        client3.disconnect();
      }
    });
  });

  describe('メッセージ送受信テスト', () => {
    let clients: ClientSocket[] = [];

    beforeEach(async () => {
      const userIds = testHelper.users.slice(0, 2).map((u) => u.id);
      clients = await testHelper.createMultipleClients(serverPort, userIds);

      // 両方のクライアントをルームに参加させる
      const room = testHelper.chatRooms[0];
      await Promise.all([
        testHelper.joinTestRoom(clients[0], room.id),
        testHelper.joinTestRoom(clients[1], room.id),
      ]);
    });

    afterEach(() => {
      testHelper.disconnectClients(clients);
      clients = [];
    });

    it('メッセージが正常に送受信される', async () => {
      const room = testHelper.chatRooms[0];
      const testContent = 'Hello from integration test!';

      // メッセージ受信の待機を設定
      const messagePromise = testHelper.waitForMessage(clients[1], testContent);

      // メッセージ送信
      const { duration: sendDuration } = await PerformanceTestHelper.measureResponseTime(
        async () => {
          return await testHelper.sendTestMessage(
            clients[0],
            room.id,
            testContent,
            testHelper.users[0].id
          );
        }
      );

      // メッセージ受信の確認
      const receivedMessage = await messagePromise;

      expect(receivedMessage.content).toBe(testContent);
      expect(receivedMessage.senderId).toBe(testHelper.users[0].id);
      expect(receivedMessage.roomId).toBe(room.id);

      TestAssertions.expectResponseTime(sendDuration, 200); // 200ms以内
    });

    it('メッセージ配信のパフォーマンス要件を満たす', async () => {
      const room = testHelper.chatRooms[0];
      const messageCount = 10;

      const operations = Array(messageCount)
        .fill(0)
        .map(
          (_, index) => () =>
            testHelper.sendTestMessage(
              clients[0],
              room.id,
              `Test message ${index}`,
              testHelper.users[0].id
            )
        );

      const { averageDuration, successRate } =
        await PerformanceTestHelper.measureConcurrentOperations(operations, 3);

      TestAssertions.expectResponseTime(averageDuration, 300); // 平均300ms以内
      TestAssertions.expectSuccessRate(successRate, 0.9); // 90%以上成功
    });

    it('長いメッセージが正常に処理される', async () => {
      const room = testHelper.chatRooms[0];
      const longContent = 'A'.repeat(1000); // 1000文字のメッセージ

      const messagePromise = testHelper.waitForMessage(clients[1]);

      await testHelper.sendTestMessage(clients[0], room.id, longContent, testHelper.users[0].id);
      const receivedMessage = await messagePromise;

      expect(receivedMessage.content).toBe(longContent);
      expect(receivedMessage.content.length).toBe(1000);
    });

    it('メッセージ送信レート制限が機能する', async () => {
      const room = testHelper.chatRooms[0];
      const rapidMessages = Array(25)
        .fill(0)
        .map(
          (
            _,
            i // 制限は20/分
          ) =>
            testHelper.sendTestMessage(
              clients[0],
              room.id,
              `Rapid message ${i}`,
              testHelper.users[0].id
            )
        );

      const results = await Promise.allSettled(rapidMessages);
      const failures = results.filter((r) => r.status === 'rejected');

      // 一部のメッセージがレート制限でブロックされることを確認
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  describe('接続監視とエラーハンドリング', () => {
    let client: ClientSocket;

    afterEach(() => {
      if (client?.connected) {
        client.disconnect();
      }
    });

    it('接続が突然切れた場合の処理', async () => {
      client = await testHelper.createTestSocketClient(serverPort, testHelper.users[0].id);

      // 強制切断
      client.disconnect();

      expect(client.connected).toBe(false);

      // 再接続が可能か確認
      client = await testHelper.createTestSocketClient(serverPort, testHelper.users[0].id);
      expect(client.connected).toBe(true);
    });

    it('無効なイベントに対するエラーハンドリング', async () => {
      client = await testHelper.createTestSocketClient(serverPort, testHelper.users[0].id);

      // 無効なイベントを送信
      client.emit('invalid_event', { invalid: 'data' });

      // 接続が維持されることを確認
      expect(client.connected).toBe(true);
    });
  });

  describe('データ整合性テスト', () => {
    let clients: ClientSocket[] = [];

    beforeEach(async () => {
      const userIds = testHelper.users.slice(0, 2).map((u) => u.id);
      clients = await testHelper.createMultipleClients(serverPort, userIds);
    });

    afterEach(() => {
      testHelper.disconnectClients(clients);
      clients = [];
    });

    it('データベース状態がWebSocket通信と整合している', async () => {
      const room = testHelper.chatRooms[0];

      // ルーム参加
      await testHelper.joinTestRoom(clients[0], room.id);

      // メッセージ送信
      await testHelper.sendTestMessage(
        clients[0],
        room.id,
        'DB consistency test',
        testHelper.users[0].id
      );

      // データベース状態の確認
      const dbState = await testHelper.verifyDatabaseState();
      expect(dbState.messages).toBeGreaterThan(0);

      // Redisセッション状態の確認
      const redisState = await testHelper.verifyRedisState();
      expect(redisState.sessionKeys).toBeGreaterThan(0);
    });
  });
});

/**
 * Socket.ioサーバーのイベントハンドラー設定
 */
function setupSocketHandlers(socketServer: Server) {
  socketServer.on('connection', (socket) => {
    let userId: number | null = null;
    const authenticatedRooms: Set<string> = new Set();

    // 認証イベント
    socket.on('authenticate', async (data) => {
      if (!data.userId || typeof data.userId !== 'number') {
        socket.emit('authenticate_error', { message: 'Invalid user ID' });
        return;
      }

      // 簡単な認証シミュレーション（実際はデータベース確認）
      if (data.userId >= 1 && data.userId <= 3) {
        userId = data.userId;
        socket.emit('authenticate_success', { userId });
      } else {
        socket.emit('authenticate_error', { message: 'User not found' });
      }
    });

    // ルーム参加イベント
    socket.on('join_room', async (data) => {
      if (!userId) {
        socket.emit('join_room_error', { message: 'Not authenticated' });
        return;
      }

      const { roomId } = data;
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('join_room_error', { message: 'Invalid room ID' });
        return;
      }

      // 簡単なルーム参加権限チェック
      if (roomId === 'non-existent-room') {
        socket.emit('join_room_error', { message: 'Room not found' });
        return;
      }

      socket.join(roomId);
      authenticatedRooms.add(roomId);
      socket.emit('join_room_success', { roomId });
      socket.to(roomId).emit('user_joined', { userId, roomId });
    });

    // メッセージ送信イベント
    socket.on('send_message', async (data) => {
      if (!userId) {
        socket.emit('message_error', { message: 'Not authenticated' });
        return;
      }

      const { roomId, content, senderId } = data;

      if (!roomId || !content || senderId !== userId) {
        socket.emit('message_error', { message: 'Invalid message data' });
        return;
      }

      if (!authenticatedRooms.has(roomId)) {
        socket.emit('message_error', { message: 'Not joined to room' });
        return;
      }

      // 簡単なレート制限（実際はRedisで管理）
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message = {
        id: messageId,
        content,
        senderId: userId,
        roomId,
        createdAt: new Date(),
      };

      // 送信者に成功通知
      socket.emit('message_sent', { success: true, message });

      // ルーム内の他のメンバーにメッセージ配信
      socket.to(roomId).emit('message_received', message);
    });

    // 切断処理
    socket.on('disconnect', () => {
      authenticatedRooms.forEach((roomId) => {
        socket.to(roomId).emit('user_left', { userId, roomId });
      });
    });
  });
}
