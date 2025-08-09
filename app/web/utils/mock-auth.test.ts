import { describe, expect, it, vi } from 'vitest';
import { mockAuthApi } from './mock-auth';

describe('Mock Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should return success for valid credentials', async () => {
      const result = await mockAuthApi.login({
        email: 'admin@example.com',
        password: 'Admin123',
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
      });
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid credentials', async () => {
      const result = await mockAuthApi.login({
        email: 'invalid@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('メールアドレスまたはパスワードが正しくありません');
    });

    it('should simulate network delay', async () => {
      const startTime = Date.now();

      await mockAuthApi.login({
        email: 'admin@example.com',
        password: 'Admin123',
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(500);
    });
  });

  describe('register', () => {
    it('should return success for new user registration', async () => {
      const result = await mockAuthApi.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

      expect(result.success).toBe(true);
      expect(result.user?.name).toBe('New User');
      expect(result.user?.email).toBe('new@example.com');
      expect(result.error).toBeUndefined();
    });

    it('should return error for existing email', async () => {
      const result = await mockAuthApi.register({
        name: 'Test User',
        email: 'admin@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('このメールアドレスは既に登録されています');
    });

    it('should return error for password mismatch', async () => {
      const result = await mockAuthApi.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Different123',
      });

      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('パスワードが一致しません');
    });
  });

  describe('getCurrentUser', () => {
    it('should return user if session exists', async () => {
      // Mock localStorage to have a session
      const mockUser = { id: 1, name: 'Admin User', email: 'admin@example.com' };
      vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue(JSON.stringify(mockUser)),
      });

      const result = await mockAuthApi.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should return null if no session exists', async () => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn().mockReturnValue(null),
      });

      const result = await mockAuthApi.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.user).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear session and return success', async () => {
      const mockRemoveItem = vi.fn();
      vi.stubGlobal('localStorage', {
        removeItem: mockRemoveItem,
      });

      const result = await mockAuthApi.logout();

      expect(result.success).toBe(true);
      expect(mockRemoveItem).toHaveBeenCalledWith('nanika_game_user');
    });
  });
});
