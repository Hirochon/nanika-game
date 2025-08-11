import type { ChatRoom } from '../entities/chat-room.entity';
import type { ChatRoomId } from '../value-objects/chat-room-id.vo';
import type { UserId } from '../value-objects/user-id.vo';

export interface IChatRoomRepository {
  findById(id: ChatRoomId): Promise<ChatRoom | null>;
  findByUserId(userId: UserId): Promise<ChatRoom[]>;
  findDirectChatByUsers(userA: UserId, userB: UserId): Promise<ChatRoom | null>;
  save(chatRoom: ChatRoom): Promise<void>;
  delete(id: ChatRoomId): Promise<void>;

  // ページネーション対応
  findByUserIdWithPagination(
    userId: UserId,
    limit: number,
    cursor?: Date
  ): Promise<{
    rooms: ChatRoom[];
    hasNext: boolean;
    nextCursor?: Date;
  }>;
}
