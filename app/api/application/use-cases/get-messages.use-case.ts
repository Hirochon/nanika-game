import { inject, injectable } from 'tsyringe';
import type { IChatRoomRepository } from '../../../domain/repositories/chat-room.repository';
import type { IMessageRepository } from '../../../domain/repositories/message.repository';
import { ChatRoomId } from '../../../domain/value-objects/chat-room-id.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { DomainError } from '../../../shared/errors/domain.error';

export interface GetMessagesCommand {
  readonly chatRoomId: number;
  readonly userId: number;
  readonly limit?: number;
  readonly cursor?: Date;
  readonly direction?: 'before' | 'after';
  readonly messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
}

export interface GetMessagesResult {
  readonly messages: MessageDetail[];
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly nextCursor?: Date;
  readonly previousCursor?: Date;
}

export interface MessageDetail {
  readonly id: number;
  readonly content: string;
  readonly messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  readonly sender: {
    id: number;
    name: string;
  };
  readonly sentAt: Date;
  readonly editedAt?: Date;
  readonly isDeleted: boolean;
}

@injectable()
export class GetMessagesUseCase {
  constructor(
    @inject('MessageRepository')
    private readonly messageRepository: IMessageRepository,
    @inject('ChatRoomRepository')
    private readonly chatRoomRepository: IChatRoomRepository
  ) {}

  async execute(command: GetMessagesCommand): Promise<GetMessagesResult> {
    const { chatRoomId, userId, limit = 20, cursor } = command;

    // コマンド検証
    this.validateCommand(command);

    // チャットルームアクセス権限チェック
    const chatRoomIdVO = ChatRoomId.create(chatRoomId);
    const userIdVO = UserId.create(userId);

    const chatRoom = await this.chatRoomRepository.findById(chatRoomIdVO);
    if (!chatRoom) {
      throw new DomainError('指定されたチャットルームが見つかりません');
    }

    if (!chatRoom.canSendMessage(userIdVO)) {
      throw new DomainError('このチャットルームへのアクセス権限がありません');
    }

    // メッセージ取得
    const result = await this.messageRepository.findByChatRoomIdWithPagination(
      chatRoomIdVO,
      Math.min(limit, 100), // 最大100件に制限
      cursor
    );

    // 結果変換
    const messageDetails: MessageDetail[] = result.messages
      .filter((message) => !message.isDeleted) // 削除されたメッセージは除外
      .map((message) => ({
        id: message.id.value,
        content: message.getDisplayContent(),
        messageType: message.messageType,
        sender: {
          id: message.senderId.value,
          name: 'Unknown User', // 実際の実装では送信者名を取得
        },
        sentAt: message.sentAt,
        editedAt: message.editedAt || undefined,
        isDeleted: message.isDeleted,
      }));

    return {
      messages: messageDetails,
      hasNext: result.hasNext,
      hasPrevious: result.hasPrevious,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
    };
  }

  private validateCommand(command: GetMessagesCommand): void {
    const { chatRoomId, userId, limit, direction, messageType } = command;

    if (!Number.isInteger(chatRoomId) || chatRoomId <= 0) {
      throw new DomainError('チャットルームIDが無効です');
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new DomainError('ユーザーIDが無効です');
    }

    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0 || limit > 100)) {
      throw new DomainError('制限値は1-100の範囲で指定してください');
    }

    if (direction && !['before', 'after'].includes(direction)) {
      throw new DomainError('方向指定が無効です');
    }

    if (messageType && !['TEXT', 'IMAGE', 'FILE', 'SYSTEM'].includes(messageType)) {
      throw new DomainError('メッセージタイプが無効です');
    }
  }
}
