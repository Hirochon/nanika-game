import type { Message } from '../entities/message.entity';
import type { ChatRoomId } from '../value-objects/chat-room-id.vo';
import type { MessageId } from '../value-objects/message-id.vo';
import type { UserId } from '../value-objects/user-id.vo';

export interface IMessageRepository {
  findById(id: MessageId): Promise<Message | null>;
  findByChatRoomId(chatRoomId: ChatRoomId): Promise<Message[]>;
  findByChatRoomIdWithPagination(
    chatRoomId: ChatRoomId,
    limit: number,
    cursor?: Date
  ): Promise<{
    messages: Message[];
    hasNext: boolean;
    hasPrevious: boolean;
    nextCursor?: Date;
    previousCursor?: Date;
  }>;
  save(message: Message): Promise<void>;
  delete(id: MessageId): Promise<void>;

  // 統計情報取得
  countUnreadMessages(chatRoomId: ChatRoomId, userId: UserId): Promise<number>;
}
