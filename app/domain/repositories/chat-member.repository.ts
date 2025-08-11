import type { ChatMember } from '../entities/chat-member.entity';
import type { ChatMemberId } from '../value-objects/chat-member-id.vo';
import type { ChatRoomId } from '../value-objects/chat-room-id.vo';
import type { UserId } from '../value-objects/user-id.vo';

export interface IChatMemberRepository {
  findById(id: ChatMemberId): Promise<ChatMember | null>;
  findByChatRoomId(chatRoomId: ChatRoomId): Promise<ChatMember[]>;
  findByUserId(userId: UserId): Promise<ChatMember[]>;
  findByChatRoomIdAndUserId(chatRoomId: ChatRoomId, userId: UserId): Promise<ChatMember | null>;
  save(member: ChatMember): Promise<void>;
  delete(id: ChatMemberId): Promise<void>;

  // アクティブメンバーのみ取得
  findActiveMembersByChatRoomId(chatRoomId: ChatRoomId): Promise<ChatMember[]>;
}
