import type { Request, Response } from 'express';
import { DomainError } from '../../shared/errors/domain.error';
import type { GetMessagesUseCase } from '../application/use-cases/get-messages.use-case';
import type { SendMessageUseCase } from '../application/use-cases/send-message.use-case';
import { container, TOKENS } from '../infrastructure/config/container';

export class MessageController {
  private sendMessageUseCase: SendMessageUseCase;
  private getMessagesUseCase: GetMessagesUseCase;

  constructor() {
    this.sendMessageUseCase = container.resolve(TOKENS.SendMessageUseCase);
    this.getMessagesUseCase = container.resolve(TOKENS.GetMessagesUseCase);
  }

  async getMessages(req: Request, res: Response): Promise<void> {
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

      const { limit, cursor, direction, messageType } = req.query;

      const result = await this.getMessagesUseCase.execute({
        chatRoomId: roomId,
        userId,
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor ? new Date(cursor as string) : undefined,
        direction: direction as 'before' | 'after' | undefined,
        messageType: messageType as 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM' | undefined,
      });

      res.json({
        success: true,
        data: {
          messages: result.messages,
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious,
          nextCursor: result.nextCursor?.toISOString(),
          previousCursor: result.previousCursor?.toISOString(),
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Get messages error:', error);
      this.handleError(res, error);
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
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

      const { content, messageType } = req.body;

      // リクエストバリデーション
      if (!content || typeof content !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'メッセージ内容が必要です',
          },
        });
        return;
      }

      if (messageType && !['TEXT', 'IMAGE', 'FILE'].includes(messageType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'メッセージタイプが無効です',
          },
        });
        return;
      }

      const result = await this.sendMessageUseCase.execute({
        chatRoomId: roomId,
        senderId: userId,
        content,
        messageType: messageType || 'TEXT',
      });

      res.status(201).json({
        success: true,
        data: {
          message: {
            id: result.id,
            content: result.content,
            messageType: result.messageType,
            sender: {
              id: result.senderId,
              name: 'Current User', // 実際の実装ではユーザー名を取得
            },
            sentAt: result.sentAt.toISOString(),
            editedAt: result.editedAt?.toISOString(),
            isDeleted: result.isDeleted,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Send message error:', error);

      if (error instanceof DomainError) {
        if (error.message.includes('権限')) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: error.message,
            },
          });
          return;
        }

        if (error.message.includes('見つかりません')) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
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

  async editMessage(req: Request, res: Response): Promise<void> {
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

      const _roomId = parseInt(req.params.roomId);
      const messageId = parseInt(req.params.messageId);
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'メッセージ内容が必要です',
          },
        });
        return;
      }

      // 実装は後で EditMessageUseCase を作成して実装

      res.json({
        success: true,
        data: {
          message: {
            id: messageId,
            content,
            messageType: 'TEXT',
            sender: {
              id: userId,
              name: 'Current User',
            },
            sentAt: new Date().toISOString(),
            editedAt: new Date().toISOString(),
            isDeleted: false,
          },
        },
      });
    } catch (error) {
      console.error('Edit message error:', error);
      this.handleError(res, error);
    }
  }

  async deleteMessage(req: Request, res: Response): Promise<void> {
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

      const messageId = parseInt(req.params.messageId);

      // 実装は後で DeleteMessageUseCase を作成して実装

      res.json({
        success: true,
        data: {
          messageId,
        },
      });
    } catch (error) {
      console.error('Delete message error:', error);
      this.handleError(res, error);
    }
  }

  private getUserIdFromSession(_req: Request): number | null {
    // 実際の実装ではセッションやJWTから取得
    // 暫定的に固定値を返す
    return 1;
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
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    });
  }
}
