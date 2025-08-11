import { describe, expect, it } from 'vitest';
import { DomainError } from '../../shared/errors/domain.error';
import { UserId } from '../value-objects/user-id.vo';
import { MemberRole } from './chat-member.entity';
import { ChatRoom, ChatRoomType } from './chat-room.entity';

describe('ChatRoom', () => {
  describe('create', () => {
    it('ダイレクトチャットルームを作成できる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.DIRECT);

      expect(chatRoom.type).toBe(ChatRoomType.DIRECT);
      expect(chatRoom.name).toBeNull();
      expect(chatRoom.description).toBeNull();
      expect(chatRoom.isActive).toBe(true);
      expect(chatRoom.members.length).toBe(0);
    });

    it('グループチャットルームを作成できる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ', 'テスト用チャット');

      expect(chatRoom.type).toBe(ChatRoomType.GROUP);
      expect(chatRoom.name).toBe('テストグループ');
      expect(chatRoom.description).toBe('テスト用チャット');
      expect(chatRoom.isActive).toBe(true);
    });

    it('グループチャットで名前が未指定の場合エラー', () => {
      expect(() => {
        ChatRoom.create(ChatRoomType.GROUP);
      }).toThrow(DomainError);
      expect(() => {
        ChatRoom.create(ChatRoomType.GROUP);
      }).toThrow('グループチャットには名前が必要です');
    });

    it('名前が100文字を超える場合エラー', () => {
      const longName = 'a'.repeat(101);
      expect(() => {
        ChatRoom.create(ChatRoomType.GROUP, longName);
      }).toThrow(DomainError);
      expect(() => {
        ChatRoom.create(ChatRoomType.GROUP, longName);
      }).toThrow('チャットルーム名は100文字以内で入力してください');
    });
  });

  describe('addMember', () => {
    it('メンバーを追加できる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      chatRoom.addMember(userId, MemberRole.MEMBER);

      expect(chatRoom.members.length).toBe(1);
      expect(chatRoom.members[0].userId.equals(userId)).toBe(true);
      expect(chatRoom.members[0].role).toBe(MemberRole.MEMBER);
    });

    it('既存のメンバーを追加しようとするとエラー', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      chatRoom.addMember(userId, MemberRole.MEMBER);

      expect(() => {
        chatRoom.addMember(userId, MemberRole.MEMBER);
      }).toThrow(DomainError);
      expect(() => {
        chatRoom.addMember(userId, MemberRole.MEMBER);
      }).toThrow('ユーザーは既にメンバーです');
    });

    it('ダイレクトチャットで3人目を追加しようとするとエラー', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.DIRECT);
      const userId1 = UserId.create(1);
      const userId2 = UserId.create(2);
      const userId3 = UserId.create(3);

      chatRoom.addMember(userId1);
      chatRoom.addMember(userId2);

      expect(() => {
        chatRoom.addMember(userId3);
      }).toThrow(DomainError);
      expect(() => {
        chatRoom.addMember(userId3);
      }).toThrow('ダイレクトチャットは2人まで参加可能です');
    });

    it('グループチャットで101人目を追加しようとするとエラー', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');

      // 100人のメンバーを追加
      for (let i = 1; i <= 100; i++) {
        chatRoom.addMember(UserId.create(i));
      }

      expect(() => {
        chatRoom.addMember(UserId.create(101));
      }).toThrow(DomainError);
      expect(() => {
        chatRoom.addMember(UserId.create(101));
      }).toThrow('グループチャットは100人まで参加可能です');
    });
  });

  describe('removeMember', () => {
    it('メンバーを削除できる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      chatRoom.addMember(userId, MemberRole.MEMBER);
      chatRoom.removeMember(userId);

      expect(chatRoom.members.length).toBe(0);
    });

    it('存在しないメンバーを削除しようとするとエラー', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      expect(() => {
        chatRoom.removeMember(userId);
      }).toThrow(DomainError);
      expect(() => {
        chatRoom.removeMember(userId);
      }).toThrow('ユーザーはメンバーではありません');
    });
  });

  describe('canSendMessage', () => {
    it('アクティブなメンバーはメッセージ送信できる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      chatRoom.addMember(userId);

      expect(chatRoom.canSendMessage(userId)).toBe(true);
    });

    it('メンバーでないユーザーはメッセージ送信できない', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      expect(chatRoom.canSendMessage(userId)).toBe(false);
    });

    it('非アクティブなチャットルームではメッセージ送信できない', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      chatRoom.addMember(userId);
      chatRoom.deactivate();

      expect(chatRoom.canSendMessage(userId)).toBe(false);
    });
  });

  describe('canManageRoom', () => {
    it('オーナーはルーム管理できる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      chatRoom.addMember(userId, MemberRole.OWNER);

      expect(chatRoom.canManageRoom(userId)).toBe(true);
    });

    it('管理者はルーム管理できる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      chatRoom.addMember(userId, MemberRole.ADMIN);

      expect(chatRoom.canManageRoom(userId)).toBe(true);
    });

    it('一般メンバーはルーム管理できない', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const userId = UserId.create(1);

      chatRoom.addMember(userId, MemberRole.MEMBER);

      expect(chatRoom.canManageRoom(userId)).toBe(false);
    });
  });

  describe('validateMessage', () => {
    it('有効なメッセージは true を返す', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');

      expect(chatRoom.validateMessage('有効なメッセージ')).toBe(true);
    });

    it('空文字列は false を返す', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');

      expect(chatRoom.validateMessage('')).toBe(false);
      expect(chatRoom.validateMessage('   ')).toBe(false);
    });

    it('長すぎるメッセージは false を返す', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');
      const longMessage = 'a'.repeat(10001);

      expect(chatRoom.validateMessage(longMessage)).toBe(false);
    });
  });

  describe('updateInfo', () => {
    it('グループチャットの情報を更新できる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, '古い名前', '古い説明');

      chatRoom.updateInfo('新しい名前', '新しい説明');

      expect(chatRoom.name).toBe('新しい名前');
      expect(chatRoom.description).toBe('新しい説明');
    });

    it('グループチャットで名前をnullに更新しようとするとエラー', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'グループ名');

      expect(() => {
        chatRoom.updateInfo(null, '新しい説明');
      }).toThrow(DomainError);
      expect(() => {
        chatRoom.updateInfo(null, '新しい説明');
      }).toThrow('グループチャットには名前が必要です');
    });
  });

  describe('deactivate', () => {
    it('チャットルームを非アクティブにできる', () => {
      const chatRoom = ChatRoom.create(ChatRoomType.GROUP, 'テストグループ');

      chatRoom.deactivate();

      expect(chatRoom.isActive).toBe(false);
    });
  });
});
