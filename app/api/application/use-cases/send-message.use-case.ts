import { inject, injectable } from 'tsyringe';
import { Message, MessageType } from '../../../domain/entities/message.entity';
import type { IChatRoomRepository } from '../../../domain/repositories/chat-room.repository';
import type { IMessageRepository } from '../../../domain/repositories/message.repository';
import { ChatRoomId } from '../../../domain/value-objects/chat-room-id.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { DomainError } from '../../../shared/errors/domain.error';
import type { SendMessageCommand } from '../commands/send-message.command';
import type { SendMessageResult } from '../results/send-message.result';

@injectable()
export class SendMessageUseCase {
  constructor(
    @inject('ChatRoomRepository')
    private readonly chatRoomRepository: IChatRoomRepository,
    @inject('MessageRepository')
    private readonly messageRepository: IMessageRepository
  ) {}

  async execute(command: SendMessageCommand): Promise<SendMessageResult> {
    const { chatRoomId, senderId, content, messageType = 'TEXT' } = command;

    // コマンド検証
    this.validateCommand(command);

    // チャットルーム存在確認
    const chatRoomIdVO = ChatRoomId.create(chatRoomId);
    const chatRoom = await this.chatRoomRepository.findById(chatRoomIdVO);
    if (!chatRoom) {
      throw new DomainError('指定されたチャットルームが見つかりません');
    }

    // 送信権限チェック
    const senderIdVO = UserId.create(senderId);
    if (!chatRoom.canSendMessage(senderIdVO)) {
      throw new DomainError('このチャットルームにメッセージを送信する権限がありません');
    }

    // メッセージ内容の検証
    if (!chatRoom.validateMessage(content)) {
      throw new DomainError('メッセージの内容が無効です');
    }

    // メッセージ作成
    const messageTypeEnum = this.convertMessageType(messageType);
    const message = Message.create(chatRoomIdVO, senderIdVO, content, messageTypeEnum);

    // メッセージ保存
    await this.messageRepository.save(message);

    // 結果を返す
    return {
      id: message.id.value,
      chatRoomId: message.chatRoomId.value,
      senderId: message.senderId.value,
      content: message.content.value,
      messageType: message.messageType,
      sentAt: message.sentAt,
      editedAt: message.editedAt,
      isDeleted: message.isDeleted,
      isEdited: message.isEdited,
    };
  }

  private validateCommand(command: SendMessageCommand): void {
    const { chatRoomId, senderId, content, messageType } = command;

    if (!Number.isInteger(chatRoomId) || chatRoomId <= 0) {
      throw new DomainError('チャットルームIDが無効です');
    }

    if (!Number.isInteger(senderId) || senderId <= 0) {
      throw new DomainError('送信者IDが無効です');
    }

    if (!content || typeof content !== 'string') {
      throw new DomainError('メッセージ内容が無効です');
    }

    if (messageType && !['TEXT', 'IMAGE', 'FILE'].includes(messageType)) {
      throw new DomainError('メッセージタイプが無効です');
    }
  }

  private convertMessageType(type: string): MessageType {
    switch (type) {
      case 'TEXT':
        return MessageType.TEXT;
      case 'IMAGE':
        return MessageType.IMAGE;
      case 'FILE':
        return MessageType.FILE;
      default:
        return MessageType.TEXT;
    }
  }
}
