import { DomainError } from '../../shared/errors/domain.error';
import { ChatRoomId } from '../value-objects/chat-room-id.vo';
import type { UserId } from '../value-objects/user-id.vo';
import { ChatMember, MemberRole } from './chat-member.entity';
import type { Message } from './message.entity';

export class ChatRoom {
  private constructor(
    private readonly _id: ChatRoomId,
    private readonly _type: ChatRoomType,
    private _name: string | null,
    private _description: string | null,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _members: ChatMember[] = [],
    private _messages: Message[] = []
  ) {}

  // ファクトリーメソッド
  static create(
    type: ChatRoomType,
    name: string | null = null,
    description: string | null = null
  ): ChatRoom {
    if (type === ChatRoomType.GROUP && !name) {
      throw new DomainError('グループチャットには名前が必要です');
    }

    if (name && name.length > 100) {
      throw new DomainError('チャットルーム名は100文字以内で入力してください');
    }

    const now = new Date();
    return new ChatRoom(ChatRoomId.generate(), type, name, description, true, now, now);
  }

  // 既存データから復元
  static reconstruct(
    id: ChatRoomId,
    type: ChatRoomType,
    name: string | null,
    description: string | null,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
    members: ChatMember[] = [],
    messages: Message[] = []
  ): ChatRoom {
    return new ChatRoom(
      id,
      type,
      name,
      description,
      isActive,
      createdAt,
      updatedAt,
      members,
      messages
    );
  }

  // ゲッター
  get id(): ChatRoomId {
    return this._id;
  }
  get type(): ChatRoomType {
    return this._type;
  }
  get name(): string | null {
    return this._name;
  }
  get description(): string | null {
    return this._description;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get members(): readonly ChatMember[] {
    return [...this._members];
  }
  get messages(): readonly Message[] {
    return [...this._messages];
  }

  // ビジネスロジック
  addMember(userId: UserId, role: MemberRole = MemberRole.MEMBER): void {
    if (this.isMember(userId)) {
      throw new DomainError('ユーザーは既にメンバーです');
    }

    if (this._type === ChatRoomType.DIRECT && this._members.length >= 2) {
      throw new DomainError('ダイレクトチャットは2人まで参加可能です');
    }

    if (this._type === ChatRoomType.GROUP && this._members.length >= 100) {
      throw new DomainError('グループチャットは100人まで参加可能です');
    }

    const member = ChatMember.create(this._id, userId, role);
    this._members.push(member);
    this._updatedAt = new Date();
  }

  removeMember(userId: UserId): void {
    const memberIndex = this._members.findIndex((m) => m.userId.equals(userId));
    if (memberIndex === -1) {
      throw new DomainError('ユーザーはメンバーではありません');
    }

    this._members.splice(memberIndex, 1);
    this._updatedAt = new Date();

    // オーナーが退出した場合、次の管理者をオーナーにする
    if (this._type === ChatRoomType.GROUP) {
      const owner = this._members.find((m) => m.role === MemberRole.OWNER);
      if (!owner) {
        const nextAdmin = this._members.find((m) => m.role === MemberRole.ADMIN);
        if (nextAdmin) {
          nextAdmin.promoteToOwner();
        } else if (this._members.length > 0) {
          this._members[0].promoteToOwner();
        }
      }
    }
  }

  canSendMessage(userId: UserId): boolean {
    if (!this._isActive) return false;
    return this.isMember(userId);
  }

  canManageRoom(userId: UserId): boolean {
    const member = this.getMember(userId);
    if (!member) return false;
    return member.role === MemberRole.OWNER || member.role === MemberRole.ADMIN;
  }

  validateMessage(content: string): boolean {
    if (!content || content.trim().length === 0) return false;
    if (content.length > 10000) return false;
    return true;
  }

  getUnreadCount(userId: UserId): number {
    const member = this.getMember(userId);
    if (!member) return 0;

    if (!member.lastReadAt) {
      return this._messages.filter((m) => !m.isDeleted).length;
    }

    return this._messages.filter((m) => !m.isDeleted && m.sentAt > member.lastReadAt!).length;
  }

  updateInfo(name: string | null, description: string | null): void {
    if (this._type === ChatRoomType.GROUP && !name) {
      throw new DomainError('グループチャットには名前が必要です');
    }

    if (name && name.length > 100) {
      throw new DomainError('チャットルーム名は100文字以内で入力してください');
    }

    this._name = name;
    this._description = description;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  // プライベートメソッド
  private isMember(userId: UserId): boolean {
    return this._members.some((m) => m.userId.equals(userId) && m.isActive);
  }

  private getMember(userId: UserId): ChatMember | undefined {
    return this._members.find((m) => m.userId.equals(userId) && m.isActive);
  }
}

export enum ChatRoomType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}
