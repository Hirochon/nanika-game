import { inject, injectable } from 'tsyringe';
import type { IChatRoomRepository } from '../../../domain/repositories/chat-room.repository';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { DomainError } from '../../../shared/errors/domain.error';

export interface GetChatRoomsCommand {
  readonly userId: number;
  readonly type?: 'DIRECT' | 'GROUP' | 'ALL';
  readonly limit?: number;
  readonly cursor?: Date;
}

export interface GetChatRoomsResult {
  readonly rooms: ChatRoomSummary[];
  readonly hasNext: boolean;
  readonly nextCursor?: Date;
}

export interface ChatRoomSummary {
  readonly id: number;
  readonly type: 'DIRECT' | 'GROUP';
  readonly name: string | null;
  readonly description: string | null;
  readonly memberCount: number;
  readonly unreadCount: number;
  readonly lastMessage?: {
    content: string;
    sentAt: Date;
    senderName: string;
  };
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class GetChatRoomsUseCase {
  constructor(
    @inject('ChatRoomRepository')
    private readonly chatRoomRepository: IChatRoomRepository
  ) {}

  async execute(command: GetChatRoomsCommand): Promise<GetChatRoomsResult> {
    const { userId, type = 'ALL', limit = 20, cursor } = command;

    // コマンド検証
    this.validateCommand(command);

    const userIdVO = UserId.create(userId);

    // チャットルーム取得
    const { rooms, hasNext, nextCursor } = await this.chatRoomRepository.findByUserIdWithPagination(
      userIdVO,
      Math.min(limit, 100), // 最大100件に制限
      cursor
    );

    // タイプフィルタリング
    const filteredRooms = type === 'ALL' ? rooms : rooms.filter((room) => room.type === type);

    // 結果変換
    const roomSummaries: ChatRoomSummary[] = filteredRooms.map((room) => ({
      id: room.id.value,
      type: room.type,
      name: room.name,
      description: room.description,
      memberCount: room.members.length,
      unreadCount: room.getUnreadCount(userIdVO),
      lastMessage: this.getLastMessageSummary(room),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }));

    return {
      rooms: roomSummaries,
      hasNext,
      nextCursor,
    };
  }

  private validateCommand(command: GetChatRoomsCommand): void {
    const { userId, limit, type } = command;

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new DomainError('ユーザーIDが無効です');
    }

    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0 || limit > 100)) {
      throw new DomainError('制限値は1-100の範囲で指定してください');
    }

    if (type && !['DIRECT', 'GROUP', 'ALL'].includes(type)) {
      throw new DomainError('チャットタイプが無効です');
    }
  }

  private getLastMessageSummary(room: {
    messages?: Array<{ isDeleted: boolean; sentAt: Date; getDisplayContent: () => string }>;
  }) {
    const messages = room.messages;
    if (!messages || messages.length === 0) {
      return undefined;
    }

    const lastMessage = messages
      .filter((m) => !m.isDeleted)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];

    if (!lastMessage) {
      return undefined;
    }

    return {
      content: lastMessage.getDisplayContent(),
      sentAt: lastMessage.sentAt,
      senderName: 'Unknown User', // 実際の実装では送信者名を取得
    };
  }
}
