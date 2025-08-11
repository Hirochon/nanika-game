import { DomainError } from '../../shared/errors/domain.error';
import type { ChatRoomId } from '../value-objects/chat-room-id.vo';
import { MessageContent } from '../value-objects/message-content.vo';
import { MessageId } from '../value-objects/message-id.vo';
import type { UserId } from '../value-objects/user-id.vo';

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
    const messageContent = MessageContent.create(content);
    const now = new Date();

    return new Message(
      MessageId.generate(),
      chatRoomId,
      senderId,
      messageContent,
      messageType,
      now,
      null,
      false
    );
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
    );
  }

  // ゲッター
  get id(): MessageId {
    return this._id;
  }
  get chatRoomId(): ChatRoomId {
    return this._chatRoomId;
  }
  get senderId(): UserId {
    return this._senderId;
  }
  get content(): MessageContent {
    return this._content;
  }
  get messageType(): MessageType {
    return this._messageType;
  }
  get sentAt(): Date {
    return this._sentAt;
  }
  get editedAt(): Date | null {
    return this._editedAt;
  }
  get isDeleted(): boolean {
    return this._isDeleted;
  }
  get isEdited(): boolean {
    return this._editedAt !== null;
  }

  // ビジネスロジック
  canEdit(userId: UserId): boolean {
    if (this._isDeleted) return false;
    if (!this._senderId.equals(userId)) return false;
    if (this._messageType !== MessageType.TEXT) return false;

    // 送信から15分以内のみ編集可能
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    return this._sentAt > fifteenMinutesAgo;
  }

  canDelete(userId: UserId): boolean {
    if (this._isDeleted) return false;
    return this._senderId.equals(userId);
  }

  edit(content: string, editorId: UserId): void {
    if (!this.canEdit(editorId)) {
      throw new DomainError('メッセージを編集できません');
    }

    this._content = MessageContent.create(content);
    this._editedAt = new Date();
  }

  delete(deleterId: UserId): void {
    if (!this.canDelete(deleterId)) {
      throw new DomainError('メッセージを削除できません');
    }

    this._isDeleted = true;
  }

  // システムメッセージの場合の特別な処理
  isSystemMessage(): boolean {
    return this._messageType === MessageType.SYSTEM;
  }

  // エディション履歴を含めたコンテンツ取得（将来実装）
  getDisplayContent(): string {
    if (this._isDeleted) return '[削除されたメッセージ]';
    return this._content.value;
  }
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}
