# チャット機能 ドメインモデル・型定義設計書

## 概要

本ドキュメントは、チャット機能のドメインモデル、エンティティ、値オブジェクト、およびTypeScript型定義の詳細設計を定義します。DDDの原則に基づき、ビジネスロジックをドメイン層に集約した設計を行います。

## ドメインモデル全体図

```mermaid
classDiagram
    class ChatRoom {
        -ChatRoomId id
        -ChatRoomType type
        -string? name
        -string? description
        -boolean isActive
        -Date createdAt
        -Date updatedAt
        -ChatMember[] members
        -Message[] messages
        +addMember(userId: UserId) void
        +removeMember(userId: UserId) void
        +canSendMessage(userId: UserId) boolean
        +canManageRoom(userId: UserId) boolean
        +validateMessage(content: string) boolean
        +getUnreadCount(userId: UserId) number
    }

    class Message {
        -MessageId id
        -ChatRoomId chatRoomId
        -UserId senderId
        -MessageContent content
        -MessageType messageType
        -Date sentAt
        -Date? editedAt
        -boolean isDeleted
        +canEdit(userId: UserId) boolean
        +canDelete(userId: UserId) boolean
        +edit(content: string) void
        +delete() void
        +isEditableBy(userId: UserId) boolean
    }

    class ChatMember {
        -ChatMemberId id
        -ChatRoomId chatRoomId
        -UserId userId
        -MemberRole role
        -Date joinedAt
        -Date? lastReadAt
        -boolean isActive
        +canInviteMembers() boolean
        +canRemoveMembers() boolean
        +canManageRoom() boolean
        +updateLastRead(messageId: MessageId) void
        +getUnreadCount() number
    }

    class ChatRoomId {
        -number value
        +equals(other: ChatRoomId) boolean
        +toString() string
    }

    class MessageId {
        -number value
        +equals(other: MessageId) boolean
        +toString() string
    }

    class MessageContent {
        -string value
        +validate() boolean
        +sanitize() string
        +length() number
    }

    ChatRoom ||--o{ ChatMember : contains
    ChatRoom ||--o{ Message : contains
    ChatMember ||--|| UserId : belongsTo
    Message ||--|| UserId : sentBy
```

## エンティティ定義

### 1. ChatRoom エンティティ

```typescript
// app/domain/entities/ChatRoom.ts
import { ChatRoomId } from '../value-objects/ChatRoomId'
import { UserId } from '../value-objects/UserId'
import { ChatMember } from './ChatMember'
import { Message } from './Message'

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
      throw new DomainError('グループチャットには名前が必要です')
    }
    
    if (name && name.length > 100) {
      throw new DomainError('チャットルーム名は100文字以内で入力してください')
    }

    const now = new Date()
    return new ChatRoom(
      ChatRoomId.generate(),
      type,
      name,
      description,
      true,
      now,
      now
    )
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
    )
  }

  // ゲッター
  get id(): ChatRoomId { return this._id }
  get type(): ChatRoomType { return this._type }
  get name(): string | null { return this._name }
  get description(): string | null { return this._description }
  get isActive(): boolean { return this._isActive }
  get createdAt(): Date { return this._createdAt }
  get updatedAt(): Date { return this._updatedAt }
  get members(): readonly ChatMember[] { return [...this._members] }
  get messages(): readonly Message[] { return [...this._messages] }

  // ビジネスロジック
  addMember(userId: UserId, role: MemberRole = MemberRole.MEMBER): void {
    if (this.isMember(userId)) {
      throw new DomainError('ユーザーは既にメンバーです')
    }

    if (this._type === ChatRoomType.DIRECT && this._members.length >= 2) {
      throw new DomainError('ダイレクトチャットは2人まで参加可能です')
    }

    if (this._type === ChatRoomType.GROUP && this._members.length >= 100) {
      throw new DomainError('グループチャットは100人まで参加可能です')
    }

    const member = ChatMember.create(this._id, userId, role)
    this._members.push(member)
    this._updatedAt = new Date()
  }

  removeMember(userId: UserId): void {
    const memberIndex = this._members.findIndex(m => m.userId.equals(userId))
    if (memberIndex === -1) {
      throw new DomainError('ユーザーはメンバーではありません')
    }

    this._members.splice(memberIndex, 1)
    this._updatedAt = new Date()

    // オーナーが退出した場合、次の管理者をオーナーにする
    if (this._type === ChatRoomType.GROUP) {
      const owner = this._members.find(m => m.role === MemberRole.OWNER)
      if (!owner) {
        const nextAdmin = this._members.find(m => m.role === MemberRole.ADMIN)
        if (nextAdmin) {
          nextAdmin.promoteToOwner()
        } else if (this._members.length > 0) {
          this._members[0].promoteToOwner()
        }
      }
    }
  }

  canSendMessage(userId: UserId): boolean {
    if (!this._isActive) return false
    return this.isMember(userId)
  }

  canManageRoom(userId: UserId): boolean {
    const member = this.getMember(userId)
    if (!member) return false
    return member.role === MemberRole.OWNER || member.role === MemberRole.ADMIN
  }

  validateMessage(content: string): boolean {
    if (!content || content.trim().length === 0) return false
    if (content.length > 10000) return false
    return true
  }

  getUnreadCount(userId: UserId): number {
    const member = this.getMember(userId)
    if (!member) return 0

    if (!member.lastReadAt) {
      return this._messages.filter(m => !m.isDeleted).length
    }

    return this._messages.filter(
      m => !m.isDeleted && m.sentAt > member.lastReadAt!
    ).length
  }

  updateInfo(name: string | null, description: string | null): void {
    if (this._type === ChatRoomType.GROUP && !name) {
      throw new DomainError('グループチャットには名前が必要です')
    }

    if (name && name.length > 100) {
      throw new DomainError('チャットルーム名は100文字以内で入力してください')
    }

    this._name = name
    this._description = description
    this._updatedAt = new Date()
  }

  deactivate(): void {
    this._isActive = false
    this._updatedAt = new Date()
  }

  // プライベートメソッド
  private isMember(userId: UserId): boolean {
    return this._members.some(m => m.userId.equals(userId) && m.isActive)
  }

  private getMember(userId: UserId): ChatMember | undefined {
    return this._members.find(m => m.userId.equals(userId) && m.isActive)
  }
}

export enum ChatRoomType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP'
}
```

### 2. Message エンティティ

```typescript
// app/domain/entities/Message.ts
import { MessageId } from '../value-objects/MessageId'
import { ChatRoomId } from '../value-objects/ChatRoomId'
import { UserId } from '../value-objects/UserId'
import { MessageContent } from '../value-objects/MessageContent'

export class Message {
  private constructor(
    private readonly _id: MessageId,
    private readonly _chatRoomId: ChatRoomId,
    private readonly _senderId: UserId,
    private _content: MessageContent,
    private readonly _messageType: MessageType,
    private readonly _sentAt: Date,
    private _editedAt: Date | null,
    private _isDeleted: boolean
  ) {}

  static create(
    chatRoomId: ChatRoomId,
    senderId: UserId,
    content: string,
    messageType: MessageType = MessageType.TEXT
  ): Message {
    const messageContent = MessageContent.create(content)
    const now = new Date()

    return new Message(
      MessageId.generate(),
      chatRoomId,
      senderId,
      messageContent,
      messageType,
      now,
      null,
      false
    )
  }

  static reconstruct(
    id: MessageId,
    chatRoomId: ChatRoomId,
    senderId: UserId,
    content: string,
    messageType: MessageType,
    sentAt: Date,
    editedAt: Date | null,
    isDeleted: boolean
  ): Message {
    return new Message(
      id,
      chatRoomId,
      senderId,
      MessageContent.create(content),
      messageType,
      sentAt,
      editedAt,
      isDeleted
    )
  }

  // ゲッター
  get id(): MessageId { return this._id }
  get chatRoomId(): ChatRoomId { return this._chatRoomId }
  get senderId(): UserId { return this._senderId }
  get content(): MessageContent { return this._content }
  get messageType(): MessageType { return this._messageType }
  get sentAt(): Date { return this._sentAt }
  get editedAt(): Date | null { return this._editedAt }
  get isDeleted(): boolean { return this._isDeleted }
  get isEdited(): boolean { return this._editedAt !== null }

  // ビジネスロジック
  canEdit(userId: UserId): boolean {
    if (this._isDeleted) return false
    if (!this._senderId.equals(userId)) return false
    if (this._messageType !== MessageType.TEXT) return false
    
    // 送信から15分以内のみ編集可能
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
    return this._sentAt > fifteenMinutesAgo
  }

  canDelete(userId: UserId): boolean {
    if (this._isDeleted) return false
    return this._senderId.equals(userId)
  }

  edit(content: string, editorId: UserId): void {
    if (!this.canEdit(editorId)) {
      throw new DomainError('メッセージを編集できません')
    }

    this._content = MessageContent.create(content)
    this._editedAt = new Date()
  }

  delete(deleterId: UserId): void {
    if (!this.canDelete(deleterId)) {
      throw new DomainError('メッセージを削除できません')
    }

    this._isDeleted = true
  }

  // システムメッセージの場合の特別な処理
  isSystemMessage(): boolean {
    return this._messageType === MessageType.SYSTEM
  }

  // エディション履歴を含めたコンテンツ取得（将来実装）
  getDisplayContent(): string {
    if (this._isDeleted) return '[削除されたメッセージ]'
    return this._content.value
  }
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM'
}
```

### 3. ChatMember エンティティ

```typescript
// app/domain/entities/ChatMember.ts
import { ChatMemberId } from '../value-objects/ChatMemberId'
import { ChatRoomId } from '../value-objects/ChatRoomId'
import { UserId } from '../value-objects/UserId'
import { MessageId } from '../value-objects/MessageId'

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
    const now = new Date()
    return new ChatMember(
      ChatMemberId.generate(),
      chatRoomId,
      userId,
      role,
      now,
      null,
      true
    )
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
    return new ChatMember(
      id,
      chatRoomId,
      userId,
      role,
      joinedAt,
      lastReadAt,
      isActive
    )
  }

  // ゲッター
  get id(): ChatMemberId { return this._id }
  get chatRoomId(): ChatRoomId { return this._chatRoomId }
  get userId(): UserId { return this._userId }
  get role(): MemberRole { return this._role }
  get joinedAt(): Date { return this._joinedAt }
  get lastReadAt(): Date | null { return this._lastReadAt }
  get isActive(): boolean { return this._isActive }

  // ビジネスロジック
  canInviteMembers(): boolean {
    return this._role === MemberRole.OWNER || this._role === MemberRole.ADMIN
  }

  canRemoveMembers(): boolean {
    return this._role === MemberRole.OWNER || this._role === MemberRole.ADMIN
  }

  canManageRoom(): boolean {
    return this._role === MemberRole.OWNER || this._role === MemberRole.ADMIN
  }

  canPromoteToAdmin(): boolean {
    return this._role === MemberRole.OWNER
  }

  canDemoteFromAdmin(): boolean {
    return this._role === MemberRole.OWNER
  }

  updateLastRead(readAt: Date): void {
    if (!this._isActive) {
      throw new DomainError('非アクティブなメンバーは既読更新できません')
    }
    
    this._lastReadAt = readAt
  }

  promoteToAdmin(): void {
    if (this._role === MemberRole.OWNER) {
      throw new DomainError('オーナーは降格できません')
    }
    this._role = MemberRole.ADMIN
  }

  promoteToOwner(): void {
    this._role = MemberRole.OWNER
  }

  demoteToMember(): void {
    if (this._role === MemberRole.OWNER) {
      throw new DomainError('オーナーは降格できません')
    }
    this._role = MemberRole.MEMBER
  }

  leave(): void {
    this._isActive = false
  }

  rejoin(): void {
    this._isActive = true
  }

  // 既読機能関連
  hasReadMessage(messageId: MessageId, messageSentAt: Date): boolean {
    if (!this._lastReadAt) return false
    return messageSentAt <= this._lastReadAt
  }

  // メンバーとしての権限チェック
  hasPermission(permission: Permission): boolean {
    switch (permission) {
      case Permission.SEND_MESSAGE:
        return this._isActive
      case Permission.INVITE_MEMBERS:
        return this.canInviteMembers()
      case Permission.REMOVE_MEMBERS:
        return this.canRemoveMembers()
      case Permission.MANAGE_ROOM:
        return this.canManageRoom()
      case Permission.PROMOTE_MEMBER:
        return this.canPromoteToAdmin()
      case Permission.DEMOTE_MEMBER:
        return this.canDemoteFromAdmin()
      default:
        return false
    }
  }
}

export enum MemberRole {
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN', 
  OWNER = 'OWNER'
}

export enum Permission {
  SEND_MESSAGE = 'SEND_MESSAGE',
  INVITE_MEMBERS = 'INVITE_MEMBERS',
  REMOVE_MEMBERS = 'REMOVE_MEMBERS',
  MANAGE_ROOM = 'MANAGE_ROOM',
  PROMOTE_MEMBER = 'PROMOTE_MEMBER',
  DEMOTE_MEMBER = 'DEMOTE_MEMBER'
}
```

## 値オブジェクト定義

### 1. ID系値オブジェクト

```typescript
// app/domain/value-objects/ChatRoomId.ts
export class ChatRoomId {
  private constructor(private readonly _value: number) {
    if (!Number.isInteger(_value) || _value <= 0) {
      throw new DomainError('ChatRoomIdは正の整数である必要があります')
    }
  }

  static create(value: number): ChatRoomId {
    return new ChatRoomId(value)
  }

  static generate(): ChatRoomId {
    // 実際の実装では、データベースのAUTO_INCREMENTに依存
    // ここでは一時的なIDを生成
    return new ChatRoomId(Math.floor(Math.random() * 1000000))
  }

  get value(): number {
    return this._value
  }

  equals(other: ChatRoomId): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value.toString()
  }
}

// app/domain/value-objects/MessageId.ts
export class MessageId {
  private constructor(private readonly _value: number) {
    if (!Number.isInteger(_value) || _value <= 0) {
      throw new DomainError('MessageIdは正の整数である必要があります')
    }
  }

  static create(value: number): MessageId {
    return new MessageId(value)
  }

  static generate(): MessageId {
    return new MessageId(Math.floor(Math.random() * 1000000))
  }

  get value(): number {
    return this._value
  }

  equals(other: MessageId): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value.toString()
  }
}

// app/domain/value-objects/ChatMemberId.ts
export class ChatMemberId {
  private constructor(private readonly _value: number) {
    if (!Number.isInteger(_value) || _value <= 0) {
      throw new DomainError('ChatMemberIdは正の整数である必要があります')
    }
  }

  static create(value: number): ChatMemberId {
    return new ChatMemberId(value)
  }

  static generate(): ChatMemberId {
    return new ChatMemberId(Math.floor(Math.random() * 1000000))
  }

  get value(): number {
    return this._value
  }

  equals(other: ChatMemberId): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value.toString()
  }
}
```

### 2. MessageContent 値オブジェクト

```typescript
// app/domain/value-objects/MessageContent.ts
export class MessageContent {
  private static readonly MAX_LENGTH = 10000
  private static readonly MIN_LENGTH = 1

  private constructor(private readonly _value: string) {
    this.validate()
  }

  static create(value: string): MessageContent {
    return new MessageContent(value)
  }

  get value(): string {
    return this._value
  }

  get length(): number {
    return this._value.length
  }

  private validate(): void {
    if (!this._value || typeof this._value !== 'string') {
      throw new DomainError('メッセージ内容は文字列である必要があります')
    }

    const trimmed = this._value.trim()
    if (trimmed.length < MessageContent.MIN_LENGTH) {
      throw new DomainError('メッセージは空にできません')
    }

    if (this._value.length > MessageContent.MAX_LENGTH) {
      throw new DomainError(`メッセージは${MessageContent.MAX_LENGTH}文字以内で入力してください`)
    }
  }

  // HTMLエスケープされたコンテンツを取得
  sanitized(): string {
    return this._value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  // 検索用の正規化されたコンテンツ
  normalized(): string {
    return this._value.toLowerCase().trim()
  }

  // メンション、URL、絵文字などを含むかチェック
  containsMention(): boolean {
    return /@\w+/.test(this._value)
  }

  containsUrl(): boolean {
    return /https?:\/\/[^\s]+/.test(this._value)
  }

  // 文字数制限チェック
  isWithinLimit(): boolean {
    return this._value.length <= MessageContent.MAX_LENGTH
  }

  equals(other: MessageContent): boolean {
    return this._value === other._value
  }
}
```

## ドメインサービス

```typescript
// app/domain/services/ChatDomainService.ts
import { ChatRoom, ChatRoomType } from '../entities/ChatRoom'
import { UserId } from '../value-objects/UserId'
import { IChatRoomRepository } from '../repositories/IChatRoomRepository'

export class ChatDomainService {
  constructor(
    private readonly chatRoomRepository: IChatRoomRepository
  ) {}

  // ダイレクトチャットの重複チェック
  async canCreateDirectChat(
    userAId: UserId, 
    userBId: UserId
  ): Promise<boolean> {
    const existingRoom = await this.chatRoomRepository.findDirectChatByUsers(
      userAId, 
      userBId
    )
    return !existingRoom
  }

  // チャットルーム作成時のビジネスルール適用
  async createChatRoom(
    type: ChatRoomType,
    creatorId: UserId,
    memberIds: UserId[],
    name?: string,
    description?: string
  ): Promise<ChatRoom> {
    // ダイレクトチャットの場合の検証
    if (type === ChatRoomType.DIRECT) {
      if (memberIds.length !== 1) {
        throw new DomainError('ダイレクトチャットは1人の相手を指定してください')
      }

      const canCreate = await this.canCreateDirectChat(creatorId, memberIds[0])
      if (!canCreate) {
        throw new DomainError('このユーザーとのダイレクトチャットは既に存在します')
      }
    }

    // グループチャットの場合の検証
    if (type === ChatRoomType.GROUP) {
      if (!name) {
        throw new DomainError('グループチャットには名前が必要です')
      }
      if (memberIds.length > 99) {
        throw new DomainError('グループチャットは100人まで参加可能です')
      }
    }

    // チャットルーム作成
    const chatRoom = ChatRoom.create(type, name, description)
    
    // 作成者をオーナーとして追加
    chatRoom.addMember(creatorId, MemberRole.OWNER)
    
    // 指定されたメンバーを追加
    memberIds.forEach(memberId => {
      chatRoom.addMember(memberId, MemberRole.MEMBER)
    })

    return chatRoom
  }

  // メッセージ送信権限の総合チェック
  async canSendMessage(
    chatRoomId: ChatRoomId,
    senderId: UserId
  ): Promise<boolean> {
    const chatRoom = await this.chatRoomRepository.findById(chatRoomId)
    if (!chatRoom) return false

    return chatRoom.canSendMessage(senderId)
  }

  // チャットルーム管理権限の総合チェック
  async canManageRoom(
    chatRoomId: ChatRoomId,
    userId: UserId
  ): Promise<boolean> {
    const chatRoom = await this.chatRoomRepository.findById(chatRoomId)
    if (!chatRoom) return false

    return chatRoom.canManageRoom(userId)
  }
}
```

## リポジトリインターフェース

```typescript
// app/domain/repositories/IChatRoomRepository.ts
import { ChatRoom } from '../entities/ChatRoom'
import { ChatRoomId } from '../value-objects/ChatRoomId'
import { UserId } from '../value-objects/UserId'

export interface IChatRoomRepository {
  findById(id: ChatRoomId): Promise<ChatRoom | null>
  findByUserId(userId: UserId): Promise<ChatRoom[]>
  findDirectChatByUsers(userA: UserId, userB: UserId): Promise<ChatRoom | null>
  save(chatRoom: ChatRoom): Promise<void>
  delete(id: ChatRoomId): Promise<void>
  
  // ページネーション対応
  findByUserIdWithPagination(
    userId: UserId,
    limit: number,
    cursor?: Date
  ): Promise<{
    rooms: ChatRoom[]
    hasNext: boolean
    nextCursor?: Date
  }>
}

// app/domain/repositories/IMessageRepository.ts
import { Message } from '../entities/Message'
import { MessageId } from '../value-objects/MessageId'
import { ChatRoomId } from '../value-objects/ChatRoomId'
import { UserId } from '../value-objects/UserId'

export interface IMessageRepository {
  findById(id: MessageId): Promise<Message | null>
  findByChatRoomId(chatRoomId: ChatRoomId): Promise<Message[]>
  findByChatRoomIdWithPagination(
    chatRoomId: ChatRoomId,
    limit: number,
    cursor?: Date
  ): Promise<{
    messages: Message[]
    hasNext: boolean
    hasPrevious: boolean
    nextCursor?: Date
    previousCursor?: Date
  }>
  save(message: Message): Promise<void>
  delete(id: MessageId): Promise<void>
  
  // 統計情報取得
  countUnreadMessages(chatRoomId: ChatRoomId, userId: UserId): Promise<number>
}

// app/domain/repositories/IChatMemberRepository.ts
import { ChatMember } from '../entities/ChatMember'
import { ChatMemberId } from '../value-objects/ChatMemberId'
import { ChatRoomId } from '../value-objects/ChatRoomId'
import { UserId } from '../value-objects/UserId'

export interface IChatMemberRepository {
  findById(id: ChatMemberId): Promise<ChatMember | null>
  findByChatRoomId(chatRoomId: ChatRoomId): Promise<ChatMember[]>
  findByUserId(userId: UserId): Promise<ChatMember[]>
  findByChatRoomIdAndUserId(
    chatRoomId: ChatRoomId, 
    userId: UserId
  ): Promise<ChatMember | null>
  save(member: ChatMember): Promise<void>
  delete(id: ChatMemberId): Promise<void>
  
  // アクティブメンバーのみ取得
  findActiveMembersByChatRoomId(chatRoomId: ChatRoomId): Promise<ChatMember[]>
}
```

## TypeScript型定義

```typescript
// app/shared/types/chat-types.ts

// DTOs (Data Transfer Objects)
export interface ChatRoomDTO {
  id: number
  type: 'DIRECT' | 'GROUP'
  name: string | null
  description: string | null
  isActive: boolean
  memberCount: number
  unreadCount: number
  lastMessage: {
    content: string
    sentAt: string
    senderName: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface MessageDTO {
  id: number
  chatRoomId: number
  senderId: number
  senderName: string
  content: string
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
  sentAt: string
  editedAt: string | null
  isDeleted: boolean
  isEdited: boolean
}

export interface ChatMemberDTO {
  id: number
  chatRoomId: number
  userId: number
  userName: string
  role: 'MEMBER' | 'ADMIN' | 'OWNER'
  joinedAt: string
  lastReadAt: string | null
  isActive: boolean
}

// API Request/Response Types
export interface CreateChatRoomRequest {
  type: 'DIRECT' | 'GROUP'
  name?: string
  description?: string
  memberIds: number[]
}

export interface SendMessageRequest {
  content: string
  messageType?: 'TEXT' | 'IMAGE' | 'FILE'
  tempId?: string
}

export interface UpdateChatRoomRequest {
  name?: string
  description?: string
}

export interface InviteMemberRequest {
  userIds: number[]
}

// WebSocket Event Types
export interface SocketEvents {
  // 認証
  authenticate: { sessionToken: string }
  authenticate_success: { userId: number; socketId: string }
  authenticate_fail: { error: SocketError }

  // ルーム操作
  join_room: { roomId: number }
  leave_room: { roomId: number }
  user_joined: { roomId: number; member: ChatMemberDTO }
  user_left: { roomId: number; userId: number }

  // メッセージ
  send_message: SendMessageRequest & { roomId: number }
  message_sent: { tempId?: string; message: MessageDTO }
  message_received: { roomId: number; message: MessageDTO }
  message_edited: { roomId: number; message: MessageDTO }
  message_deleted: { roomId: number; messageId: number }

  // タイピング (Phase 2)
  typing_start: { roomId: number }
  typing_stop: { roomId: number }
  user_typing: { roomId: number; userId: number; isTyping: boolean }

  // 既読 (Phase 2)
  mark_as_read: { roomId: number; messageId: number }
  message_read: { roomId: number; userId: number; lastReadMessageId: number }
}

export interface SocketError {
  code: string
  message: string
  details?: any
}

// フロントエンド状態管理用の型
export interface ChatState {
  rooms: Record<number, ChatRoomDTO>
  messages: Record<number, MessageDTO[]> // roomId -> messages
  activeRoomId: number | null
  isConnected: boolean
  typingUsers: Record<number, number[]> // roomId -> userIds
  unreadCounts: Record<number, number> // roomId -> count
}

// Pagination Types
export interface PaginationMeta {
  limit: number
  hasNext: boolean
  hasPrevious?: boolean
  nextCursor?: string
  previousCursor?: string
  total?: number
}

// Error Types
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
  meta: {
    timestamp: string
    requestId: string
  }
}

// Success Response Types
export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: {
    pagination?: PaginationMeta
    timestamp: string
  }
}

// Utility Types
export type ChatRoomWithMessages = ChatRoomDTO & {
  messages: MessageDTO[]
  members: ChatMemberDTO[]
}

export type MessageWithSender = MessageDTO & {
  sender: {
    id: number
    name: string
    avatar?: string
  }
}

// Form Validation Types
export interface ChatValidationRules {
  chatRoomName: {
    required: boolean
    maxLength: number
    pattern?: RegExp
  }
  messageContent: {
    required: boolean
    maxLength: number
    minLength: number
  }
  memberInvite: {
    maxMembers: number
    required: boolean
  }
}

export const CHAT_VALIDATION_RULES: ChatValidationRules = {
  chatRoomName: {
    required: true,
    maxLength: 100
  },
  messageContent: {
    required: true,
    maxLength: 10000,
    minLength: 1
  },
  memberInvite: {
    maxMembers: 99,
    required: true
  }
}

// Configuration Types
export interface ChatConfig {
  maxRoomMembers: {
    direct: number
    group: number
  }
  messageLimits: {
    maxLength: number
    editTimeLimit: number // minutes
  }
  rateLimits: {
    messagesPerMinute: number
    roomJoinsPerHour: number
  }
  features: {
    typing: boolean
    readReceipts: boolean
    fileUploads: boolean
    voiceMessages: boolean
  }
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  maxRoomMembers: {
    direct: 2,
    group: 100
  },
  messageLimits: {
    maxLength: 10000,
    editTimeLimit: 15
  },
  rateLimits: {
    messagesPerMinute: 20,
    roomJoinsPerHour: 30
  },
  features: {
    typing: true,
    readReceipts: true,
    fileUploads: false,
    voiceMessages: false
  }
}
```

## カスタムエラー定義

```typescript
// app/shared/errors/chat.error.ts
import { DomainError } from './domain.error'

export class ChatDomainError extends DomainError {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'ChatDomainError'
  }
}

export class ChatRoomError extends ChatDomainError {
  static roomNotFound(roomId: number): ChatRoomError {
    return new ChatRoomError(`チャットルーム(ID: ${roomId})が見つかりません`, 'ROOM_NOT_FOUND')
  }

  static accessDenied(roomId: number): ChatRoomError {
    return new ChatRoomError(`チャットルーム(ID: ${roomId})へのアクセス権限がありません`, 'ROOM_ACCESS_DENIED')
  }

  static memberLimitExceeded(limit: number): ChatRoomError {
    return new ChatRoomError(`メンバー数の上限(${limit}人)を超えています`, 'MEMBER_LIMIT_EXCEEDED')
  }
}

export class MessageError extends ChatDomainError {
  static messageNotFound(messageId: number): MessageError {
    return new MessageError(`メッセージ(ID: ${messageId})が見つかりません`, 'MESSAGE_NOT_FOUND')
  }

  static editNotAllowed(messageId: number): MessageError {
    return new MessageError(`メッセージ(ID: ${messageId})は編集できません`, 'MESSAGE_EDIT_DENIED')
  }

  static deleteNotAllowed(messageId: number): MessageError {
    return new MessageError(`メッセージ(ID: ${messageId})は削除できません`, 'MESSAGE_DELETE_DENIED')
  }

  static contentTooLong(maxLength: number): MessageError {
    return new MessageError(`メッセージは${maxLength}文字以内で入力してください`, 'MESSAGE_TOO_LONG')
  }
}
```

## テスト用のモック・ファクトリー

```typescript
// __tests__/fixtures/chat.factory.ts
import { ChatRoom, ChatRoomType } from '../../app/domain/entities/ChatRoom'
import { Message, MessageType } from '../../app/domain/entities/Message'
import { ChatMember, MemberRole } from '../../app/domain/entities/ChatMember'

export class ChatTestFactory {
  static createDirectChatRoom(
    id: number = 1,
    name: string | null = null
  ): ChatRoom {
    return ChatRoom.reconstruct(
      ChatRoomId.create(id),
      ChatRoomType.DIRECT,
      name,
      null,
      true,
      new Date(),
      new Date()
    )
  }

  static createGroupChatRoom(
    id: number = 1,
    name: string = 'テストグループ'
  ): ChatRoom {
    return ChatRoom.reconstruct(
      ChatRoomId.create(id),
      ChatRoomType.GROUP,
      name,
      'テスト用のグループチャット',
      true,
      new Date(),
      new Date()
    )
  }

  static createMessage(
    id: number = 1,
    chatRoomId: number = 1,
    senderId: number = 1,
    content: string = 'テストメッセージ'
  ): Message {
    return Message.reconstruct(
      MessageId.create(id),
      ChatRoomId.create(chatRoomId),
      UserId.create(senderId),
      content,
      MessageType.TEXT,
      new Date(),
      null,
      false
    )
  }

  static createChatMember(
    id: number = 1,
    chatRoomId: number = 1,
    userId: number = 1,
    role: MemberRole = MemberRole.MEMBER
  ): ChatMember {
    return ChatMember.reconstruct(
      ChatMemberId.create(id),
      ChatRoomId.create(chatRoomId),
      UserId.create(userId),
      role,
      new Date(),
      null,
      true
    )
  }
}
```

---

**更新履歴:**
- 2025-08-10: 初回作成（architecture-specialist）
- 2025-08-10: ドメインエンティティ詳細化
- 2025-08-10: 値オブジェクト・型定義追加
- 2025-08-10: エラー処理・テストファクトリー追加