/**
 * Database Performance Optimizer
 * Infrastructure-specialist による データベース最適化
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';

export class DatabaseOptimizer {
  private prisma: PrismaClient;
  private redis: Redis;
  private queryCache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly DEFAULT_TTL = 300; // 5分

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
    this.setupQueryLogging();
    this.startCacheCleanup();
  }

  /**
   * 最適化されたチャットルーム取得
   * N+1問題を回避し、必要なデータのみ取得
   */
  async getOptimizedChatRooms(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      includeMessages?: boolean;
      includeOnlineStatus?: boolean;
    } = {}
  ): Promise<any[]> {
    const {
      limit = 20,
      offset = 0,
      includeMessages = false,
      includeOnlineStatus = false,
    } = options;
    const cacheKey = `chat_rooms:${userId}:${limit}:${offset}:${includeMessages}:${includeOnlineStatus}`;

    // キャッシュ確認
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    // 最適化されたクエリ
    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        ...(includeMessages && {
          messages: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10, // 最新10件のみ
          },
        }),
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip: offset,
      take: limit,
    });

    // オンラインステータスが必要な場合
    if (includeOnlineStatus) {
      const userIds = rooms.flatMap((room) => room.members.map((member) => member.user.id));
      const onlineStatuses = await this.getBulkOnlineStatus(userIds);

      rooms.forEach((room) => {
        room.members.forEach((member: any) => {
          member.user.isOnline = onlineStatuses[member.user.id] || false;
        });
      });
    }

    // キャッシュに保存
    await this.setToCache(cacheKey, rooms, this.DEFAULT_TTL);

    return rooms;
  }

  /**
   * 最適化されたメッセージ履歴取得
   * インデックスを活用し、ページネーション対応
   */
  async getOptimizedMessages(
    roomId: string,
    options: {
      limit?: number;
      before?: string; // cursor-based pagination
      after?: string;
      includeReactions?: boolean;
    } = {}
  ): Promise<{
    messages: any[];
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const { limit = 50, before, after, includeReactions = false } = options;
    const cacheKey = `messages:${roomId}:${limit}:${before}:${after}:${includeReactions}`;

    // キャッシュ確認（短期間のみ）
    const cached = await this.getFromCache(cacheKey, 60); // 1分キャッシュ
    if (cached) return cached;

    // カーソルベースページネーション用の条件構築
    const whereClause: Prisma.MessageWhereInput = {
      roomId,
      ...(before && { createdAt: { lt: new Date(before) } }),
      ...(after && { createdAt: { gt: new Date(after) } }),
    };

    // メッセージ取得（limit + 1 で hasMore 判定）
    const messages = await this.prisma.message.findMany({
      where: whereClause,
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        editedAt: true,
        messageType: true,
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
        ...(includeReactions && {
          reactions: {
            select: {
              id: true,
              emoji: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    const result = {
      messages: resultMessages.reverse(), // 古い順に並び替え
      hasMore,
      nextCursor: hasMore
        ? resultMessages[resultMessages.length - 1].createdAt.toISOString()
        : undefined,
      prevCursor: resultMessages.length > 0 ? resultMessages[0].createdAt.toISOString() : undefined,
    };

    // キャッシュに保存
    await this.setToCache(cacheKey, result, 60);

    return result;
  }

  /**
   * バッチでのオンラインステータス取得
   */
  private async getBulkOnlineStatus(userIds: number[]): Promise<Record<number, boolean>> {
    if (userIds.length === 0) return {};

    const keys = userIds.map((id) => `user_online:${id}`);
    const statuses = await this.redis.mget(...keys);

    const result: Record<number, boolean> = {};
    userIds.forEach((userId, index) => {
      result[userId] = statuses[index] === 'true';
    });

    return result;
  }

  /**
   * 最適化されたメッセージ作成
   */
  async createOptimizedMessage(data: {
    content: string;
    senderId: number;
    roomId: string;
    messageType?: string;
    replyTo?: string;
  }): Promise<any> {
    const message = await this.prisma.$transaction(async (tx) => {
      // メッセージ作成
      const newMessage = await tx.message.create({
        data: {
          content: data.content,
          senderId: data.senderId,
          roomId: data.roomId,
          messageType: data.messageType || 'TEXT',
          replyTo: data.replyTo,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          messageType: true,
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
          replyTo: true,
        },
      });

      // チャットルームの最終更新時間を更新
      await tx.chatRoom.update({
        where: { id: data.roomId },
        data: { updatedAt: new Date() },
      });

      return newMessage;
    });

    // 関連キャッシュを無効化
    await this.invalidateCache(`messages:${data.roomId}:*`);
    await this.invalidateCache(`chat_rooms:*`);

    return message;
  }

  /**
   * メッセージの一括取得（WebSocket用）
   */
  async getBulkMessagesForNotification(messageIds: string[]): Promise<any[]> {
    if (messageIds.length === 0) return [];

    // バッチ処理で効率的に取得
    return await this.prisma.message.findMany({
      where: {
        id: { in: messageIds },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        roomId: true,
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * チャットルームメンバーの効率的な取得
   */
  async getRoomMembersOptimized(roomId: string): Promise<any[]> {
    const cacheKey = `room_members:${roomId}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const members = await this.prisma.chatMember.findMany({
      where: { roomId },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.setToCache(cacheKey, members, this.DEFAULT_TTL);
    return members;
  }

  /**
   * ユーザーの参加チャットルーム数を効率的に取得
   */
  async getUserRoomCount(userId: number): Promise<number> {
    const cacheKey = `user_room_count:${userId}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached !== null) return cached;

    const count = await this.prisma.chatMember.count({
      where: { userId },
    });

    await this.setToCache(cacheKey, count, this.DEFAULT_TTL);
    return count;
  }

  /**
   * アクティブなチャットルームの統計取得
   */
  async getChatStatistics(timeRange: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalRooms: number;
    activeRooms: number;
    totalMessages: number;
    activeUsers: number;
  }> {
    const cacheKey = `chat_stats:${timeRange}`;
    const cached = await this.getFromCache(cacheKey, 300); // 5分キャッシュ
    if (cached) return cached;

    const now = new Date();
    const timeRanges = {
      hour: new Date(now.getTime() - 60 * 60 * 1000),
      day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    };

    const startTime = timeRanges[timeRange];

    const [totalRooms, activeRooms, totalMessages, activeUsers] = await Promise.all([
      // 全チャットルーム数
      this.prisma.chatRoom.count(),

      // アクティブなチャットルーム数（期間内にメッセージがあるルーム）
      this.prisma.chatRoom.count({
        where: {
          messages: {
            some: {
              createdAt: { gte: startTime },
            },
          },
        },
      }),

      // 期間内の総メッセージ数
      this.prisma.message.count({
        where: {
          createdAt: { gte: startTime },
        },
      }),

      // アクティブユーザー数（期間内にメッセージを送信したユーザー）
      this.prisma.message
        .groupBy({
          by: ['senderId'],
          where: {
            createdAt: { gte: startTime },
          },
        })
        .then((results) => results.length),
    ]);

    const stats = { totalRooms, activeRooms, totalMessages, activeUsers };
    await this.setToCache(cacheKey, stats, 300);

    return stats;
  }

  /**
   * プロセスメモリキャッシュからの取得
   */
  private async getFromCache(key: string, _customTtl?: number): Promise<any> {
    // Redis から取得を試行
    try {
      const cached = await this.redis.get(`cache:${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache get error:', error);
    }

    // プロセスメモリキャッシュから取得
    const memoryEntry = this.queryCache.get(key);
    if (memoryEntry && Date.now() < memoryEntry.expiry) {
      return memoryEntry.data;
    }

    return null;
  }

  /**
   * キャッシュへの保存
   */
  private async setToCache(key: string, data: any, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;

    // プロセスメモリキャッシュに保存
    this.queryCache.set(key, { data, expiry });

    // Redis に保存
    try {
      await this.redis.setex(`cache:${key}`, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.warn('Redis cache set error:', error);
    }
  }

  /**
   * キャッシュの無効化
   */
  private async invalidateCache(pattern: string): Promise<void> {
    // プロセスメモリキャッシュの無効化
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const [key] of this.queryCache) {
      if (regex.test(key)) {
        this.queryCache.delete(key);
      }
    }

    // Redis キャッシュの無効化
    try {
      const keys = await this.redis.keys(`cache:${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.warn('Redis cache invalidation error:', error);
    }
  }

  /**
   * クエリログの設定
   */
  private setupQueryLogging(): void {
    const originalQuery = this.prisma.$queryRaw;

    this.prisma.$queryRaw = new Proxy(originalQuery, {
      apply: async (target, thisArg, args) => {
        const startTime = Date.now();

        try {
          const result = await target.apply(thisArg, args);
          const duration = Date.now() - startTime;

          // スロークエリの警告（本番では調整）
          if (duration > 1000) {
            console.warn(`Slow query detected (${duration}ms):`, {
              query: args[0],
              duration,
              timestamp: new Date().toISOString(),
            });
          }

          return result;
        } catch (error) {
          console.error('Database query error:', {
            query: args[0],
            error: error.message,
            duration: Date.now() - startTime,
          });
          throw error;
        }
      },
    });
  }

  /**
   * 定期的なキャッシュクリーンアップ
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.queryCache) {
        if (now >= entry.expiry) {
          this.queryCache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired cache entries`);
      }
    }, 60000); // 1分毎に実行
  }

  /**
   * キャッシュ統計の取得
   */
  getCacheStats(): {
    memoryEntries: number;
    hitRate: number;
  } {
    return {
      memoryEntries: this.queryCache.size,
      hitRate: 0, // 実装時は実際のヒット率を計算
    };
  }

  /**
   * データベース接続プールの監視
   */
  async getConnectionStats(): Promise<{
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
  }> {
    // Prisma は接続プール統計を直接公開していないため、
    // 実際の実装では monitoring 拡張や外部ツールを使用
    return {
      activeConnections: 5, // 仮の値
      idleConnections: 3, // 仮の値
      totalConnections: 10, // 仮の値
    };
  }
}
