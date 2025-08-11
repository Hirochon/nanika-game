import { inject, injectable } from 'tsyringe';
import { MemberRole } from '../../../domain/entities/chat-member.entity';
import { ChatRoom, ChatRoomType } from '../../../domain/entities/chat-room.entity';
import type { IChatRoomRepository } from '../../../domain/repositories/chat-room.repository';
import { UserId } from '../../../domain/value-objects/user-id.vo';
import { DomainError } from '../../../shared/errors/domain.error';
import type { CreateChatRoomCommand } from '../commands/create-chat-room.command';
import type { CreateChatRoomResult } from '../results/create-chat-room.result';

@injectable()
export class CreateChatRoomUseCase {
  constructor(
    @inject('ChatRoomRepository')
    private readonly chatRoomRepository: IChatRoomRepository
  ) {}

  async execute(command: CreateChatRoomCommand): Promise<CreateChatRoomResult> {
    const { type, creatorId, memberIds, name, description } = command;

    // コマンド検証
    this.validateCommand(command);

    // ダイレクトチャットの重複チェック
    if (type === 'DIRECT') {
      if (memberIds.length !== 1) {
        throw new DomainError('ダイレクトチャットは1人の相手を指定してください');
      }

      const existingRoom = await this.chatRoomRepository.findDirectChatByUsers(
        UserId.create(creatorId),
        UserId.create(memberIds[0])
      );

      if (existingRoom) {
        throw new DomainError('このユーザーとのダイレクトチャットは既に存在します');
      }
    }

    // チャットルーム作成
    const chatRoomType = type === 'DIRECT' ? ChatRoomType.DIRECT : ChatRoomType.GROUP;
    const chatRoom = ChatRoom.create(chatRoomType, name, description);

    // 作成者をオーナーとして追加
    const creatorUserId = UserId.create(creatorId);
    const ownerRole = type === 'GROUP' ? MemberRole.OWNER : MemberRole.MEMBER;
    chatRoom.addMember(creatorUserId, ownerRole);

    // 指定されたメンバーを追加
    memberIds.forEach((memberId) => {
      const memberUserId = UserId.create(memberId);
      chatRoom.addMember(memberUserId, MemberRole.MEMBER);
    });

    // 保存
    await this.chatRoomRepository.save(chatRoom);

    // 結果を返す
    return {
      id: chatRoom.id.value,
      type: chatRoom.type,
      name: chatRoom.name,
      description: chatRoom.description,
      isActive: chatRoom.isActive,
      createdAt: chatRoom.createdAt,
      updatedAt: chatRoom.updatedAt,
      memberCount: chatRoom.members.length,
    };
  }

  private validateCommand(command: CreateChatRoomCommand): void {
    const { type, creatorId, memberIds, name } = command;

    if (!creatorId || creatorId <= 0) {
      throw new DomainError('作成者IDが無効です');
    }

    if (!Array.isArray(memberIds)) {
      throw new DomainError('メンバーIDは配列である必要があります');
    }

    if (memberIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new DomainError('メンバーIDは正の整数である必要があります');
    }

    if (type === 'GROUP') {
      if (!name || name.trim().length === 0) {
        throw new DomainError('グループチャットには名前が必要です');
      }
      if (memberIds.length > 99) {
        throw new DomainError('グループチャットは100人まで参加可能です');
      }
    }

    if (type === 'DIRECT') {
      if (memberIds.length !== 1) {
        throw new DomainError('ダイレクトチャットは1人の相手を指定してください');
      }
      if (memberIds[0] === creatorId) {
        throw new DomainError('自分自身とのダイレクトチャットは作成できません');
      }
    }
  }
}
