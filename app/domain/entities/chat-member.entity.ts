import { DomainError } from '../../shared/errors/domain.error';
import { ChatMemberId } from '../value-objects/chat-member-id.vo';
import type { ChatRoomId } from '../value-objects/chat-room-id.vo';
import type { UserId } from '../value-objects/user-id.vo';

export class ChatMember {
  private constructor(
    private readonly _id: ChatMemberId,
    private readonly _chatRoomId: ChatRoomId,
    private readonly _userId: UserId,
    private _role: MemberRole,
    private readonly _joinedAt: Date,
    private _lastReadAt: Date | null,
    private _isActive: boolean
  ) {}

  static create(
    chatRoomId: ChatRoomId,
    userId: UserId,
    role: MemberRole = MemberRole.MEMBER
  ): ChatMember {
    const now = new Date();
    return new ChatMember(ChatMemberId.generate(), chatRoomId, userId, role, now, null, true);
  }

  static reconstruct(
    id: ChatMemberId,
    chatRoomId: ChatRoomId,
    userId: UserId,
    role: MemberRole,
    joinedAt: Date,
    lastReadAt: Date | null,
    isActive: boolean
  ): ChatMember {
    return new ChatMember(id, chatRoomId, userId, role, joinedAt, lastReadAt, isActive);
  }

  // ゲッター
  get id(): ChatMemberId {
    return this._id;
  }
  get chatRoomId(): ChatRoomId {
    return this._chatRoomId;
  }
  get userId(): UserId {
    return this._userId;
  }
  get role(): MemberRole {
    return this._role;
  }
  get joinedAt(): Date {
    return this._joinedAt;
  }
  get lastReadAt(): Date | null {
    return this._lastReadAt;
  }
  get isActive(): boolean {
    return this._isActive;
  }

  // ビジネスロジック
  canInviteMembers(): boolean {
    return this._role === MemberRole.OWNER || this._role === MemberRole.ADMIN;
  }

  canRemoveMembers(): boolean {
    return this._role === MemberRole.OWNER || this._role === MemberRole.ADMIN;
  }

  canManageRoom(): boolean {
    return this._role === MemberRole.OWNER || this._role === MemberRole.ADMIN;
  }

  canPromoteToAdmin(): boolean {
    return this._role === MemberRole.OWNER;
  }

  canDemoteFromAdmin(): boolean {
    return this._role === MemberRole.OWNER;
  }

  updateLastRead(readAt: Date): void {
    if (!this._isActive) {
      throw new DomainError('非アクティブなメンバーは既読更新できません');
    }

    this._lastReadAt = readAt;
  }

  promoteToAdmin(): void {
    if (this._role === MemberRole.OWNER) {
      throw new DomainError('オーナーは降格できません');
    }
    this._role = MemberRole.ADMIN;
  }

  promoteToOwner(): void {
    this._role = MemberRole.OWNER;
  }

  demoteToMember(): void {
    if (this._role === MemberRole.OWNER) {
      throw new DomainError('オーナーは降格できません');
    }
    this._role = MemberRole.MEMBER;
  }

  leave(): void {
    this._isActive = false;
  }

  rejoin(): void {
    this._isActive = true;
  }

  // 既読機能関連
  hasReadMessage(messageSentAt: Date): boolean {
    if (!this._lastReadAt) return false;
    return messageSentAt <= this._lastReadAt;
  }

  // メンバーとしての権限チェック
  hasPermission(permission: Permission): boolean {
    switch (permission) {
      case Permission.SEND_MESSAGE:
        return this._isActive;
      case Permission.INVITE_MEMBERS:
        return this.canInviteMembers();
      case Permission.REMOVE_MEMBERS:
        return this.canRemoveMembers();
      case Permission.MANAGE_ROOM:
        return this.canManageRoom();
      case Permission.PROMOTE_MEMBER:
        return this.canPromoteToAdmin();
      case Permission.DEMOTE_MEMBER:
        return this.canDemoteFromAdmin();
      default:
        return false;
    }
  }
}

export enum MemberRole {
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

export enum Permission {
  SEND_MESSAGE = 'SEND_MESSAGE',
  INVITE_MEMBERS = 'INVITE_MEMBERS',
  REMOVE_MEMBERS = 'REMOVE_MEMBERS',
  MANAGE_ROOM = 'MANAGE_ROOM',
  PROMOTE_MEMBER = 'PROMOTE_MEMBER',
  DEMOTE_MEMBER = 'DEMOTE_MEMBER',
}
