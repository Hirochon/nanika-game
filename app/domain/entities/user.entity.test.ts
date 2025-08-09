import { describe, expect, it } from 'vitest';
import { User, UserInvalidError } from './user.entity';

describe('User', () => {
  describe('create', () => {
    it('正常なパラメータでユーザーを作成できる', async () => {
      const user = await User.create('テストユーザー', 'test@example.com', 'password123');

      expect(user.name).toBe('テストユーザー');
      expect(user.email.value).toBe('test@example.com');
      expect(user.id.value).toBeTypeOf('number');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('名前が空文字列の場合はエラーになる', async () => {
      await expect(() => User.create('', 'test@example.com', 'password123')).rejects.toThrow(
        UserInvalidError
      );
    });

    it('名前が50文字を超える場合はエラーになる', async () => {
      const longName = 'あ'.repeat(51);
      await expect(() => User.create(longName, 'test@example.com', 'password123')).rejects.toThrow(
        UserInvalidError
      );
    });

    it('無効なメールアドレスの場合はエラーになる', async () => {
      await expect(() =>
        User.create('テストユーザー', 'invalid-email', 'password123')
      ).rejects.toThrow();
    });

    it('無効なパスワードの場合はエラーになる', async () => {
      await expect(() =>
        User.create('テストユーザー', 'test@example.com', '123')
      ).rejects.toThrow();
    });
  });

  describe('authenticate', () => {
    it('正しいパスワードで認証が成功する', async () => {
      const user = await User.create('テストユーザー', 'test@example.com', 'password123');
      expect(await user.authenticate('password123')).toBe(true);
    });

    it('間違ったパスワードで認証が失敗する', async () => {
      const user = await User.create('テストユーザー', 'test@example.com', 'password123');
      expect(await user.authenticate('wrongpassword')).toBe(false);
    });
  });

  describe('updateName', () => {
    it('名前を更新できる', async () => {
      const user = await User.create('テストユーザー', 'test@example.com', 'password123');
      const updatedUser = user.updateName('新しい名前');

      expect(updatedUser.name).toBe('新しい名前');
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
      expect(updatedUser.id.equals(user.id)).toBe(true);
    });

    it('無効な名前の場合はエラーになる', async () => {
      const user = await User.create('テストユーザー', 'test@example.com', 'password123');

      expect(() => user.updateName('')).toThrow(UserInvalidError);
      expect(() => user.updateName('あ'.repeat(51))).toThrow(UserInvalidError);
    });
  });

  describe('equals', () => {
    it('同じIDを持つユーザーはtrueを返す', async () => {
      const user1 = await User.create('テストユーザー1', 'test1@example.com', 'password123');
      const user2 = User.reconstruct({
        id: user1.id,
        name: 'テストユーザー2',
        email: user1.email,
        password: user1.password,
        createdAt: user1.createdAt,
      });

      expect(user1.equals(user2)).toBe(true);
    });

    it('異なるIDを持つユーザーはfalseを返す', async () => {
      const user1 = await User.create('テストユーザー1', 'test1@example.com', 'password123');
      const user2 = await User.create('テストユーザー2', 'test2@example.com', 'password123');

      expect(user1.equals(user2)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('JSONオブジェクトを返す', async () => {
      const user = await User.create('テストユーザー', 'test@example.com', 'password123');
      const json = user.toJSON();

      expect(json).toEqual({
        id: user.id.value,
        name: 'テストユーザー',
        email: 'test@example.com',
        createdAt: user.createdAt.toISOString(),
        updatedAt: undefined,
      });
    });
  });
});
