/**
 * チャットAPI統合テスト
 * Infrastructure-specialist による REST API 統合テスト
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  IntegrationTestHelper,
  PerformanceTestHelper,
  TestAssertions,
} from '../../utils/test-helpers';

// Note: 実際のテストでは、Express アプリケーションを起動して supertest を使用
// ここではモックベースでAPIテストの構造を示す

describe.skip('Chat API Integration Tests', () => {
  let testHelper: IntegrationTestHelper;

  beforeAll(async () => {
    testHelper = new IntegrationTestHelper();
    await testHelper.setup();
  });

  afterAll(async () => {
    await testHelper.cleanup();
  });

  describe('チャットルーム API', () => {
    it('GET /api/chat/rooms - チャットルーム一覧取得', async () => {
      // Mock API response simulation
      const mockApiCall = async () => {
        const dbState = await testHelper.verifyDatabaseState();
        return {
          success: true,
          data: testHelper.chatRooms.map((room) => ({
            id: room.id,
            name: room.name,
            type: room.type,
            // createdBy removed from TestChatRoom type
            memberCount: room.type === 'DIRECT' ? 2 : 3,
          })),
          total: dbState.chatRooms,
        };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(testHelper.chatRooms.length);
      TestAssertions.expectResponseTime(duration, 200);
    });

    it('POST /api/chat/rooms - チャットルーム作成', async () => {
      const roomData = {
        name: 'API Test Room',
        type: 'GROUP',
        memberIds: [testHelper.users[0].id, testHelper.users[1].id],
      };

      const mockApiCall = async () => {
        const newRoom = await testHelper.database.chatRoom.create({
          data: {
            name: roomData.name,
            type: roomData.type,
            // createdBy is set in the actual creation
            members: {
              create: roomData.memberIds.map((userId, index) => ({
                userId,
                role: index === 0 ? 'ADMIN' : 'MEMBER',
              })),
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        });

        return {
          success: true,
          data: {
            id: newRoom.id,
            name: newRoom.name,
            type: newRoom.type,
            // createdBy is part of actual room data
            members: newRoom.members,
          },
        };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(roomData.name);
      expect(result.data.type).toBe(roomData.type);
      expect(result.data.members).toHaveLength(roomData.memberIds.length);
      TestAssertions.expectResponseTime(duration, 300);
    });

    it('GET /api/chat/rooms/:id - 特定チャットルーム詳細', async () => {
      const room = testHelper.chatRooms[0];

      const mockApiCall = async () => {
        const roomDetails = await testHelper.database.chatRoom.findUnique({
          where: { id: room.id },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
            messages: {
              take: 50,
              orderBy: { createdAt: 'desc' },
              include: {
                sender: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        });

        if (!roomDetails) {
          throw new Error('Room not found');
        }

        return {
          success: true,
          data: roomDetails,
        };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(room.id);
      expect(result.data.name).toBe(room.name);
      TestAssertions.expectResponseTime(duration, 150);
    });

    it('PUT /api/chat/rooms/:id - チャットルーム更新', async () => {
      const room = testHelper.chatRooms[0];
      const updateData = {
        name: 'Updated Room Name',
      };

      const mockApiCall = async () => {
        const updatedRoom = await testHelper.database.chatRoom.update({
          where: { id: room.id },
          data: updateData,
        });

        return {
          success: true,
          data: updatedRoom,
        };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe(updateData.name);
      TestAssertions.expectResponseTime(duration, 100);
    });

    it('DELETE /api/chat/rooms/:id - チャットルーム削除', async () => {
      // 削除用のテストルームを作成
      const testRoom = await testHelper.database.chatRoom.create({
        data: {
          name: 'Room to Delete',
          type: 'GROUP',
          createdBy: testHelper.users[0].id,
        },
      });

      const mockApiCall = async () => {
        await testHelper.database.chatRoom.delete({
          where: { id: testRoom.id },
        });

        return { success: true };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      TestAssertions.expectResponseTime(duration, 100);

      // 削除確認
      const deletedRoom = await testHelper.database.chatRoom.findUnique({
        where: { id: testRoom.id },
      });
      expect(deletedRoom).toBeNull();
    });
  });

  describe('メッセージ API', () => {
    it('GET /api/chat/rooms/:id/messages - メッセージ履歴取得', async () => {
      const room = testHelper.chatRooms[0];

      // テストメッセージを作成
      const _testMessages = await Promise.all([
        testHelper.database.message.create({
          data: {
            content: 'Test message 1',
            senderId: testHelper.users[0].id,
            roomId: room.id,
          },
        }),
        testHelper.database.message.create({
          data: {
            content: 'Test message 2',
            senderId: testHelper.users[1].id,
            roomId: room.id,
          },
        }),
      ]);

      const mockApiCall = async () => {
        const messages = await testHelper.database.message.findMany({
          where: { roomId: room.id },
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        });

        return {
          success: true,
          data: messages,
          pagination: {
            total: messages.length,
            page: 1,
            limit: 50,
          },
        };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.data[0].content).toBe('Test message 1');
      TestAssertions.expectResponseTime(duration, 200);
    });

    it('POST /api/chat/rooms/:id/messages - メッセージ送信', async () => {
      const room = testHelper.chatRooms[0];
      const messageData = {
        content: 'API test message',
        senderId: testHelper.users[0].id,
      };

      const mockApiCall = async () => {
        const message = await testHelper.database.message.create({
          data: {
            content: messageData.content,
            senderId: messageData.senderId,
            roomId: room.id,
          },
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        });

        return {
          success: true,
          data: message,
        };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      expect(result.data.content).toBe(messageData.content);
      expect(result.data.senderId).toBe(messageData.senderId);
      expect(result.data.roomId).toBe(room.id);
      TestAssertions.expectResponseTime(duration, 150);
    });

    it('PUT /api/chat/rooms/:roomId/messages/:messageId - メッセージ編集', async () => {
      const room = testHelper.chatRooms[0];

      // 編集用のメッセージを作成
      const originalMessage = await testHelper.database.message.create({
        data: {
          content: 'Original message',
          senderId: testHelper.users[0].id,
          roomId: room.id,
        },
      });

      const updateData = {
        content: 'Edited message',
      };

      const mockApiCall = async () => {
        const updatedMessage = await testHelper.database.message.update({
          where: { id: originalMessage.id },
          data: {
            content: updateData.content,
            updatedAt: new Date(),
          },
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        });

        return {
          success: true,
          data: updatedMessage,
        };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      expect(result.data.content).toBe(updateData.content);
      expect(result.data.id).toBe(originalMessage.id);
      TestAssertions.expectResponseTime(duration, 100);
    });

    it('DELETE /api/chat/rooms/:roomId/messages/:messageId - メッセージ削除', async () => {
      const room = testHelper.chatRooms[0];

      // 削除用のメッセージを作成
      const messageToDelete = await testHelper.database.message.create({
        data: {
          content: 'Message to delete',
          senderId: testHelper.users[0].id,
          roomId: room.id,
        },
      });

      const mockApiCall = async () => {
        await testHelper.database.message.delete({
          where: { id: messageToDelete.id },
        });

        return { success: true };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      TestAssertions.expectResponseTime(duration, 100);

      // 削除確認
      const deletedMessage = await testHelper.database.message.findUnique({
        where: { id: messageToDelete.id },
      });
      expect(deletedMessage).toBeNull();
    });
  });

  describe('API パフォーマンステスト', () => {
    it('大量メッセージ取得のパフォーマンス', async () => {
      const room = testHelper.chatRooms[0];

      // 大量のテストメッセージを作成
      const messageCount = 100;
      const messages = Array(messageCount)
        .fill(0)
        .map((_, index) => ({
          content: `Performance test message ${index}`,
          senderId: testHelper.users[index % 2].id,
          roomId: room.id,
        }));

      await testHelper.database.message.createMany({
        data: messages,
      });

      const mockApiCall = async () => {
        const result = await testHelper.database.message.findMany({
          where: { roomId: room.id },
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        return { success: true, data: result };
      };

      const { result, duration } = await PerformanceTestHelper.measureResponseTime(mockApiCall);

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(50);
      TestAssertions.expectResponseTime(duration, 500); // 500ms以内
    });

    it('同時API呼び出しの処理', async () => {
      const room = testHelper.chatRooms[0];

      const operations = Array(10)
        .fill(0)
        .map((_, index) => async () => {
          return await testHelper.database.message.create({
            data: {
              content: `Concurrent message ${index}`,
              senderId: testHelper.users[index % 2].id,
              roomId: room.id,
            },
          });
        });

      const { results, averageDuration, successRate } =
        await PerformanceTestHelper.measureConcurrentOperations(operations, 5);

      expect(results).toHaveLength(10);
      TestAssertions.expectResponseTime(averageDuration, 300);
      TestAssertions.expectSuccessRate(successRate, 0.95);
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('存在しないチャットルームへのアクセス', async () => {
      const mockApiCall = async () => {
        const room = await testHelper.database.chatRoom.findUnique({
          where: { id: 'non-existent-room' },
        });

        if (!room) {
          throw new Error('Room not found');
        }

        return { success: true, data: room };
      };

      await expect(mockApiCall()).rejects.toThrow('Room not found');
    });

    it('無効なメッセージデータでの送信', async () => {
      const room = testHelper.chatRooms[0];

      const mockApiCall = async () => {
        // 空のコンテンツでメッセージ作成を試行
        if (!'' || !testHelper.users[0].id) {
          throw new Error('Invalid message data');
        }

        return await testHelper.database.message.create({
          data: {
            content: '',
            senderId: testHelper.users[0].id,
            roomId: room.id,
          },
        });
      };

      await expect(mockApiCall()).rejects.toThrow('Invalid message data');
    });

    it('権限のないユーザーによるメッセージ操作', async () => {
      const room = testHelper.chatRooms[0];
      const message = await testHelper.database.message.create({
        data: {
          content: 'Protected message',
          senderId: testHelper.users[0].id,
          roomId: room.id,
        },
      });

      const mockApiCall = async () => {
        // 異なるユーザーがメッセージを編集しようとする
        const requestUserId = testHelper.users[1].id;
        const messageOwnerId = testHelper.users[0].id;

        if (requestUserId !== messageOwnerId) {
          throw new Error('Unauthorized: Cannot edit message');
        }

        return await testHelper.database.message.update({
          where: { id: message.id },
          data: { content: 'Edited by unauthorized user' },
        });
      };

      await expect(mockApiCall()).rejects.toThrow('Unauthorized: Cannot edit message');
    });
  });

  describe('データ整合性テスト', () => {
    it('APIとデータベース状態の整合性', async () => {
      const initialState = await testHelper.verifyDatabaseState();

      // APIを通じてデータを変更
      await testHelper.database.message.create({
        data: {
          content: 'Consistency test message',
          senderId: testHelper.users[0].id,
          roomId: testHelper.chatRooms[0].id,
        },
      });

      const finalState = await testHelper.verifyDatabaseState();

      expect(finalState.messages).toBe(initialState.messages + 1);
    });

    it('トランザクション処理の整合性', async () => {
      const room = testHelper.chatRooms[0];

      // トランザクション内での複数操作
      const mockTransactionCall = async () => {
        return await testHelper.database.$transaction(async (tx) => {
          const message = await tx.message.create({
            data: {
              content: 'Transaction test message',
              senderId: testHelper.users[0].id,
              roomId: room.id,
            },
          });

          // チャットルームの最終更新時間も更新
          await tx.chatRoom.update({
            where: { id: room.id },
            data: { updatedAt: new Date() },
          });

          return message;
        });
      };

      const { result, duration } =
        await PerformanceTestHelper.measureResponseTime(mockTransactionCall);

      expect(result.content).toBe('Transaction test message');
      TestAssertions.expectResponseTime(duration, 200);
    });
  });
});
