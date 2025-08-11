import type { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';
import { Message, type MessageType } from '../../../../domain/entities/message.entity';
import type { IMessageRepository } from '../../../../domain/repositories/message.repository';
import { ChatRoomId } from '../../../../domain/value-objects/chat-room-id.vo';
import { MessageId } from '../../../../domain/value-objects/message-id.vo';
import { UserId } from '../../../../domain/value-objects/user-id.vo';

@injectable()
export class PrismaMessageRepository implements IMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: MessageId): Promise<Message | null> {
    const messageData = await this.prisma.message.findUnique({
      where: { id: id.value },
    });

    if (!messageData) {
      return null;
    }

    return this.toDomain(messageData);
  }

  async findByChatRoomId(chatRoomId: ChatRoomId): Promise<Message[]> {
    const messageData = await this.prisma.message.findMany({
      where: {
        chatRoomId: chatRoomId.value,
        isDeleted: false,
      },
      orderBy: {
        sentAt: 'desc',
      },
    });

    return messageData.map((data) => this.toDomain(data));
  }

  async findByChatRoomIdWithPagination(
    chatRoomId: ChatRoomId,
    limit: number,
    cursor?: Date
  ): Promise<{
    messages: Message[];
    hasNext: boolean;
    hasPrevious: boolean;
    nextCursor?: Date;
    previousCursor?: Date;
  }> {
    const whereClause: any = {
      chatRoomId: chatRoomId.value,
      isDeleted: false,
    };

    if (cursor) {
      whereClause.sentAt = { lt: cursor };
    }

    // 現在のページのメッセージを取得（新しい順）
    const messageData = await this.prisma.message.findMany({
      where: whereClause,
      orderBy: {
        sentAt: 'desc',
      },
      take: limit + 1, // hasNextを判定するために1件多く取得
    });

    const hasNext = messageData.length > limit;
    const messages = messageData.slice(0, limit);

    // hasNextを判定
    const nextCursor = hasNext ? messages[messages.length - 1]?.sentAt : undefined;

    // hasPreviousを判定（cursorより新しいメッセージがあるかチェック）
    let hasPrevious = false;
    let previousCursor: Date | undefined;

    if (cursor) {
      const olderMessage = await this.prisma.message.findFirst({
        where: {
          chatRoomId: chatRoomId.value,
          isDeleted: false,
          sentAt: { gt: cursor },
        },
        orderBy: {
          sentAt: 'asc',
        },
      });

      hasPrevious = !!olderMessage;
      if (hasPrevious && messages.length > 0) {
        previousCursor = messages[0].sentAt;
      }
    }

    return {
      messages: messages.map((data) => this.toDomain(data)),
      hasNext,
      hasPrevious,
      nextCursor,
      previousCursor,
    };
  }

  async save(message: Message): Promise<void> {
    const existingMessage = await this.prisma.message.findUnique({
      where: { id: message.id.value },
    });

    if (existingMessage) {
      await this.update(message);
    } else {
      await this.create(message);
    }
  }

  async delete(id: MessageId): Promise<void> {
    await this.prisma.message.update({
      where: { id: id.value },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });
  }

  async countUnreadMessages(chatRoomId: ChatRoomId, userId: UserId): Promise<number> {
    // メンバーの最終既読時刻を取得
    const member = await this.prisma.chatMember.findFirst({
      where: {
        chatRoomId: chatRoomId.value,
        userId: userId.value,
        isActive: true,
      },
    });

    if (!member || !member.lastReadAt) {
      // 既読時刻がない場合、全てのメッセージが未読
      return await this.prisma.message.count({
        where: {
          chatRoomId: chatRoomId.value,
          isDeleted: false,
        },
      });
    }

    // 最終既読時刻より新しいメッセージをカウント
    return await this.prisma.message.count({
      where: {
        chatRoomId: chatRoomId.value,
        sentAt: { gt: member.lastReadAt },
        isDeleted: false,
      },
    });
  }

  private async create(message: Message): Promise<void> {
    await this.prisma.message.create({
      data: {
        id: message.id.value,
        chatRoomId: message.chatRoomId.value,
        senderId: message.senderId.value,
        content: message.content.value,
        messageType: message.messageType,
        sentAt: message.sentAt,
        editedAt: message.editedAt,
        isDeleted: message.isDeleted,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  private async update(message: Message): Promise<void> {
    await this.prisma.message.update({
      where: { id: message.id.value },
      data: {
        content: message.content.value,
        editedAt: message.editedAt,
        isDeleted: message.isDeleted,
        updatedAt: new Date(),
      },
    });
  }

  private toDomain(data: any): Message {
    return Message.reconstruct(
      MessageId.create(data.id),
      ChatRoomId.create(data.chatRoomId),
      UserId.create(data.senderId),
      data.content,
      data.messageType as MessageType,
      data.sentAt,
      data.editedAt,
      data.isDeleted
    );
  }
}
