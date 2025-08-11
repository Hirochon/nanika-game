import type { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';
import { ChatMember, type MemberRole } from '../../../../domain/entities/chat-member.entity';
import { ChatRoom, ChatRoomType } from '../../../../domain/entities/chat-room.entity';
import { Message, type MessageType } from '../../../../domain/entities/message.entity';
import type { IChatRoomRepository } from '../../../../domain/repositories/chat-room.repository';
import { ChatMemberId } from '../../../../domain/value-objects/chat-member-id.vo';
import { ChatRoomId } from '../../../../domain/value-objects/chat-room-id.vo';
import { MessageId } from '../../../../domain/value-objects/message-id.vo';
import { UserId } from '../../../../domain/value-objects/user-id.vo';

@injectable()
export class PrismaChatRoomRepository implements IChatRoomRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: ChatRoomId): Promise<ChatRoom | null> {
    const chatRoomData = await this.prisma.chatRoom.findUnique({
      where: { id: id.value },
      include: {
        members: {
          where: { isActive: true },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 50, // 最新50件のメッセージを含める
        },
      },
    });

    if (!chatRoomData) {
      return null;
    }

    return this.toDomain(chatRoomData);
  }

  async findByUserId(userId: UserId): Promise<ChatRoom[]> {
    const chatRoomData = await this.prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: userId.value,
            isActive: true,
          },
        },
        isActive: true,
      },
      include: {
        members: {
          where: { isActive: true },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 10, // 最新10件のメッセージを含める
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return chatRoomData.map((data) => this.toDomain(data));
  }

  async findDirectChatByUsers(userA: UserId, userB: UserId): Promise<ChatRoom | null> {
    const chatRoomData = await this.prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        isActive: true,
        members: {
          every: {
            userId: { in: [userA.value, userB.value] },
            isActive: true,
          },
        },
      },
      include: {
        members: {
          where: { isActive: true },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!chatRoomData) {
      return null;
    }

    // ダイレクトチャットが正確に2人のメンバーを持っているか確認
    const activeMembers = chatRoomData.members.filter((m) => m.isActive);
    if (activeMembers.length !== 2) {
      return null;
    }

    const memberIds = activeMembers.map((m) => m.userId).sort();
    const targetIds = [userA.value, userB.value].sort();

    if (JSON.stringify(memberIds) !== JSON.stringify(targetIds)) {
      return null;
    }

    return this.toDomain(chatRoomData);
  }

  async findByUserIdWithPagination(
    userId: UserId,
    limit: number,
    cursor?: Date
  ): Promise<{
    rooms: ChatRoom[];
    hasNext: boolean;
    nextCursor?: Date;
  }> {
    const whereClause: any = {
      members: {
        some: {
          userId: userId.value,
          isActive: true,
        },
      },
      isActive: true,
    };

    if (cursor) {
      whereClause.updatedAt = { lt: cursor };
    }

    const chatRoomData = await this.prisma.chatRoom.findMany({
      where: whereClause,
      include: {
        members: {
          where: { isActive: true },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 5, // 最新5件のメッセージを含める
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit + 1, // hasNextを判定するために1件多く取得
    });

    const hasNext = chatRoomData.length > limit;
    const rooms = chatRoomData.slice(0, limit);
    const nextCursor = hasNext ? rooms[rooms.length - 1]?.updatedAt : undefined;

    return {
      rooms: rooms.map((data) => this.toDomain(data)),
      hasNext,
      nextCursor,
    };
  }

  async save(chatRoom: ChatRoom): Promise<void> {
    const existingRoom = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoom.id.value },
    });

    if (existingRoom) {
      await this.update(chatRoom);
    } else {
      await this.create(chatRoom);
    }
  }

  async delete(id: ChatRoomId): Promise<void> {
    await this.prisma.chatRoom.update({
      where: { id: id.value },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  private async create(chatRoom: ChatRoom): Promise<void> {
    await this.prisma.chatRoom.create({
      data: {
        id: chatRoom.id.value,
        type: chatRoom.type,
        name: chatRoom.name,
        description: chatRoom.description,
        isActive: chatRoom.isActive,
        createdAt: chatRoom.createdAt,
        updatedAt: chatRoom.updatedAt,
        members: {
          create: chatRoom.members.map((member) => ({
            id: member.id.value,
            userId: member.userId.value,
            role: member.role,
            joinedAt: member.joinedAt,
            lastReadAt: member.lastReadAt,
            isActive: member.isActive,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        },
      },
    });
  }

  private async update(chatRoom: ChatRoom): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      // チャットルーム本体の更新
      await prisma.chatRoom.update({
        where: { id: chatRoom.id.value },
        data: {
          type: chatRoom.type,
          name: chatRoom.name,
          description: chatRoom.description,
          isActive: chatRoom.isActive,
          updatedAt: chatRoom.updatedAt,
        },
      });

      // メンバーの更新（既存メンバーを全て削除して再作成）
      await prisma.chatMember.deleteMany({
        where: { chatRoomId: chatRoom.id.value },
      });

      if (chatRoom.members.length > 0) {
        await prisma.chatMember.createMany({
          data: chatRoom.members.map((member) => ({
            id: member.id.value,
            chatRoomId: chatRoom.id.value,
            userId: member.userId.value,
            role: member.role,
            joinedAt: member.joinedAt,
            lastReadAt: member.lastReadAt,
            isActive: member.isActive,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        });
      }
    });
  }

  private toDomain(data: any): ChatRoom {
    const members = data.members.map((memberData: any) =>
      ChatMember.reconstruct(
        ChatMemberId.create(memberData.id),
        ChatRoomId.create(memberData.chatRoomId),
        UserId.create(memberData.userId),
        memberData.role as MemberRole,
        memberData.joinedAt,
        memberData.lastReadAt,
        memberData.isActive
      )
    );

    const messages = (data.messages || []).map((messageData: any) =>
      Message.reconstruct(
        MessageId.create(messageData.id),
        ChatRoomId.create(messageData.chatRoomId),
        UserId.create(messageData.senderId),
        messageData.content,
        messageData.messageType as MessageType,
        messageData.sentAt,
        messageData.editedAt,
        messageData.isDeleted
      )
    );

    const chatRoomType = data.type === 'DIRECT' ? ChatRoomType.DIRECT : ChatRoomType.GROUP;

    return ChatRoom.reconstruct(
      ChatRoomId.create(data.id),
      chatRoomType,
      data.name,
      data.description,
      data.isActive,
      data.createdAt,
      data.updatedAt,
      members,
      messages
    );
  }
}
