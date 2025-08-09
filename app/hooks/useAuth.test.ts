import { describe, expect, it, vi } from 'vitest';
import { mockAuthApi } from '~/utils/mock-auth';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

describe('useAuth hook logic tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate login flow with mock API', async () => {
    const loginData = {
      email: 'admin@example.com',
      password: 'Admin123',
    };

    const result = await mockAuthApi.login(loginData);

    expect(result.success).toBe(true);
    expect(result.user).toEqual({
      id: 1,
      name: 'Admin User',
      email: 'admin@example.com',
    });
  });

  it('should validate registration flow with mock API', async () => {
    const registerData = {
      name: 'New User',
      email: 'new@example.com',
      password: 'NewUser123',
      confirmPassword: 'NewUser123',
    };

    const result = await mockAuthApi.register(registerData);

    expect(result.success).toBe(true);
    expect(result.user?.name).toBe('New User');
    expect(result.user?.email).toBe('new@example.com');
  });

  it('should handle login failure', async () => {
    const loginData = {
      email: 'invalid@example.com',
      password: 'wrongpassword',
    };

    const result = await mockAuthApi.login(loginData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('メールアドレスまたはパスワードが正しくありません');
  });

  it('should handle logout', async () => {
    const result = await mockAuthApi.logout();
    expect(result.success).toBe(true);
  });
});
