import type { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';
import { ChatMember, type MemberRole } from '../../../../domain/entities/chat-member.entity';
import type { IChatMemberRepository } from '../../../../domain/repositories/chat-member.repository';
import { ChatMemberId } from '../../../../domain/value-objects/chat-member-id.vo';
import { ChatRoomId } from '../../../../domain/value-objects/chat-room-id.vo';
import { UserId } from '../../../../domain/value-objects/user-id.vo';

@injectable()
export class PrismaChatMemberRepository implements IChatMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: ChatMemberId): Promise<ChatMember | null> {
    const memberData = await this.prisma.chatMember.findUnique({
      where: { id: id.value },
    });

    if (!memberData) {
      return null;
    }

    return this.toDomain(memberData);
  }

  async findByChatRoomId(chatRoomId: ChatRoomId): Promise<ChatMember[]> {
    const memberData = await this.prisma.chatMember.findMany({
      where: {
        chatRoomId: chatRoomId.value,
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return memberData.map((data) => this.toDomain(data));
  }

  async findByUserId(userId: UserId): Promise<ChatMember[]> {
    const memberData = await this.prisma.chatMember.findMany({
      where: {
        userId: userId.value,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return memberData.map((data) => this.toDomain(data));
  }

  async findByChatRoomIdAndUserId(
    chatRoomId: ChatRoomId,
    userId: UserId
  ): Promise<ChatMember | null> {
    const memberData = await this.prisma.chatMember.findFirst({
      where: {
        chatRoomId: chatRoomId.value,
        userId: userId.value,
      },
    });

    if (!memberData) {
      return null;
    }

    return this.toDomain(memberData);
  }

  async findActiveMembersByChatRoomId(chatRoomId: ChatRoomId): Promise<ChatMember[]> {
    const memberData = await this.prisma.chatMember.findMany({
      where: {
        chatRoomId: chatRoomId.value,
        isActive: true,
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return memberData.map((data) => this.toDomain(data));
  }

  async save(member: ChatMember): Promise<void> {
    const existingMember = await this.prisma.chatMember.findUnique({
      where: { id: member.id.value },
    });

    if (existingMember) {
      await this.update(member);
    } else {
      await this.create(member);
    }
  }

  async delete(id: ChatMemberId): Promise<void> {
    await this.prisma.chatMember.update({
      where: { id: id.value },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  private async create(member: ChatMember): Promise<void> {
    await this.prisma.chatMember.create({
      data: {
        id: member.id.value,
        chatRoomId: member.chatRoomId.value,
        userId: member.userId.value,
        role: member.role,
        joinedAt: member.joinedAt,
        lastReadAt: member.lastReadAt,
        isActive: member.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  private async update(member: ChatMember): Promise<void> {
    await this.prisma.chatMember.update({
      where: { id: member.id.value },
      data: {
        role: member.role,
        lastReadAt: member.lastReadAt,
        isActive: member.isActive,
        updatedAt: new Date(),
      },
    });
  }

  private toDomain(data: any): ChatMember {
    return ChatMember.reconstruct(
      ChatMemberId.create(data.id),
      ChatRoomId.create(data.chatRoomId),
      UserId.create(data.userId),
      data.role as MemberRole,
      data.joinedAt,
      data.lastReadAt,
      data.isActive
    );
  }
}
