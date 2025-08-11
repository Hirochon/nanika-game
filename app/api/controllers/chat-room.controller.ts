import type { Request, Response } from 'express';
import { DomainError } from '../../shared/errors/domain.error';
import type { CreateChatRoomUseCase } from '../application/use-cases/create-chat-room.use-case';
import type { GetChatRoomsUseCase } from '../application/use-cases/get-chat-rooms.use-case';
import { container, TOKENS } from '../infrastructure/config/container';

export class ChatRoomController {
  private createChatRoomUseCase: CreateChatRoomUseCase;
  private getChatRoomsUseCase: GetChatRoomsUseCase;

  constructor() {
    this.createChatRoomUseCase = container.resolve(TOKENS.CreateChatRoomUseCase);
    this.getChatRoomsUseCase = container.resolve(TOKENS.GetChatRoomsUseCase);
  }

  async getChatRooms(req: Request, res: Response): Promise<void> {
    try {
      // 認証されたユーザーIDを取得（実際の実装ではセッションから取得）
      const userId = this.getUserIdFromSession(req);
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId(),
          },
        });
        return;
      }

      const { type, limit, cursor } = req.query;

      const result = await this.getChatRoomsUseCase.execute({
        userId,
        type: type as 'DIRECT' | 'GROUP' | 'ALL',
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor ? new Date(cursor as string) : undefined,
      });

      res.json({
        success: true,
        data: {
          rooms: result.rooms,
          hasNext: result.hasNext,
          nextCursor: result.nextCursor?.toISOString(),
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Get chat rooms error:', error);
      this.handleError(res, error);
    }
  }

  async getChatRoomById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserIdFromSession(req);
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
          },
        });
        return;
      }

      const roomId = parseInt(req.params.roomId);
      if (!Number.isInteger(roomId) || roomId <= 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: '無効なチャットルームIDです',
          },
        });
        return;
      }

      // チャットルーム詳細取得の実装
      // 実際の実装では GetChatRoomUseCase を作成して使用

      res.json({
        success: true,
        data: {
          room: {
            id: roomId,
            type: 'GROUP',
            name: 'サンプルチャット',
            description: 'テスト用チャットルーム',
            isActive: true,
            members: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Get chat room error:', error);
      this.handleError(res, error);
    }
  }

  async createChatRoom(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserIdFromSession(req);
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
          },
        });
        return;
      }

      const { type, name, description, memberIds } = req.body;

      // リクエストバリデーション
      if (!type || !['DIRECT', 'GROUP'].includes(type)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'チャットタイプが無効です',
          },
        });
        return;
      }

      if (!Array.isArray(memberIds)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'メンバーIDは配列である必要があります',
          },
        });
        return;
      }

      const result = await this.createChatRoomUseCase.execute({
        type,
        creatorId: userId,
        memberIds,
        name,
        description,
      });

      res.status(201).json({
        success: true,
        data: {
          room: result,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Create chat room error:', error);

      if (error instanceof DomainError) {
        if (error.message.includes('既に存在します')) {
          res.status(409).json({
            success: false,
            error: {
              code: 'CONFLICT',
              message: error.message,
            },
          });
          return;
        }

        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        });
        return;
      }

      this.handleError(res, error);
    }
  }

  async updateChatRoom(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.getUserIdFromSession(req);
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
          },
        });
        return;
      }

      const roomId = parseInt(req.params.roomId);
      const { name, description } = req.body;

      // 実装は後で UpdateChatRoomUseCase を作成して実装

      res.json({
        success: true,
        data: {
          room: {
            id: roomId,
            type: 'GROUP',
            name: name || 'Updated Room',
            description: description || 'Updated description',
            isActive: true,
            members: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Update chat room error:', error);
      this.handleError(res, error);
    }
  }

  private getUserIdFromSession(_req: Request): number | null {
    // 実際の実装ではセッションやJWTから取得
    // 暫定的に固定値を返す
    return 1;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(res: Response, error: unknown): void {
    const err = error as { status?: number; code?: string };
    const statusCode = err.status || 500;
    const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
    const message = error instanceof Error ? error.message : 'Internal server error';

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      },
    });
  }
}
