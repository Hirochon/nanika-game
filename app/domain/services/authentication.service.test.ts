import { User } from '@domain/entities/user.entity';
import type { IUserRepository } from '@domain/repositories/user.repository';
import type { Email } from '@domain/value-objects/email.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AuthenticationFailedError,
  AuthenticationService,
  UserAlreadyExistsError,
} from './authentication.service';

// モックリポジトリ
class MockUserRepository implements IUserRepository {
  private users: User[] = [];

  async findById(id: UserId): Promise<User | null> {
    return this.users.find((user) => user.id.equals(id)) || null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    return this.users.find((user) => user.email.equals(email)) || null;
  }

  async save(user: User): Promise<void> {
    const existingIndex = this.users.findIndex((u) => u.id.equals(user.id));
    if (existingIndex >= 0) {
      this.users[existingIndex] = user;
    } else {
      this.users.push(user);
    }
  }

  async delete(id: UserId): Promise<void> {
    this.users = this.users.filter((user) => !user.id.equals(id));
  }

  // テスト用メソッド
  clear(): void {
    this.users = [];
  }
}

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockUserRepository: MockUserRepository;

  beforeEach(() => {
    mockUserRepository = new MockUserRepository();
    authService = new AuthenticationService(mockUserRepository);
  });

  describe('authenticate', () => {
    it('正しい認証情報で認証が成功する', async () => {
      const user = await User.create('テストユーザー', 'test@example.com', 'password123');
      await mockUserRepository.save(user);

      const authenticatedUser = await authService.authenticate('test@example.com', 'password123');

      expect(authenticatedUser.email.value).toBe('test@example.com');
      expect(authenticatedUser.name).toBe('テストユーザー');
    });

    it('存在しないメールアドレスの場合は認証が失敗する', async () => {
      await expect(
        authService.authenticate('nonexistent@example.com', 'password123')
      ).rejects.toThrow(AuthenticationFailedError);
    });

    it('間違ったパスワードの場合は認証が失敗する', async () => {
      const user = await User.create('テストユーザー', 'test@example.com', 'password123');
      await mockUserRepository.save(user);

      await expect(authService.authenticate('test@example.com', 'wrongpassword')).rejects.toThrow(
        AuthenticationFailedError
      );
    });

    it('無効なメールフォーマットの場合はエラーになる', async () => {
      await expect(authService.authenticate('invalid-email', 'password123')).rejects.toThrow();
    });
  });

  describe('registerUser', () => {
    it('新規ユーザーを登録できる', async () => {
      const user = await authService.registerUser(
        '新規ユーザー',
        'newuser@example.com',
        'password123'
      );

      expect(user.name).toBe('新規ユーザー');
      expect(user.email.value).toBe('newuser@example.com');

      // リポジトリに保存されているかを確認
      const savedUser = await mockUserRepository.findByEmail(user.email);
      expect(savedUser).not.toBeNull();
      expect(savedUser?.name).toBe('新規ユーザー');
    });

    it('既存のメールアドレスの場合はエラーになる', async () => {
      const existingUser = await User.create('既存ユーザー', 'existing@example.com', 'password123');
      await mockUserRepository.save(existingUser);

      await expect(
        authService.registerUser('新規ユーザー', 'existing@example.com', 'password123')
      ).rejects.toThrow(UserAlreadyExistsError);
    });

    it('無効な入力の場合はエラーになる', async () => {
      await expect(
        authService.registerUser('', 'test@example.com', 'password123')
      ).rejects.toThrow();

      await expect(
        authService.registerUser('ユーザー', 'invalid-email', 'password123')
      ).rejects.toThrow();

      await expect(
        authService.registerUser('ユーザー', 'test@example.com', '123')
      ).rejects.toThrow();
    });
  });
});
