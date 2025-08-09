import type { LoginFormData, RegisterFormData } from './validation';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * サーバーサイド用Mock authentication API
 */
export const mockAuthServerApi = {
  /**
   * サーバーサイド用ログイン機能
   */
  async login(data: LoginFormData): Promise<AuthResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log('Server-side login attempt:', data);

    // Mock users database
    const users = [
      { id: 1, name: 'Admin User', email: 'admin@example.com', password: 'Admin123' },
      { id: 2, name: 'Test User', email: 'test@example.com', password: 'Test123' },
    ];

    const user = users.find((u) => u.email === data.email && u.password === data.password);

    if (user) {
      const { password, ...userWithoutPassword } = user;

      console.log('Login successful:', userWithoutPassword);

      return {
        success: true,
        user: userWithoutPassword,
      };
    }

    console.log('Login failed: invalid credentials');
    return {
      success: false,
      error: 'メールアドレスまたはパスワードが正しくありません',
    };
  },

  /**
   * サーバーサイド用登録機能
   */
  async register(data: RegisterFormData): Promise<AuthResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check for password mismatch (validation should catch this, but double-check)
    if (data.password !== data.confirmPassword) {
      return {
        success: false,
        error: 'パスワードが一致しません',
      };
    }

    // Mock existing users check
    const existingEmails = ['admin@example.com', 'test@example.com'];
    if (existingEmails.includes(data.email)) {
      return {
        success: false,
        error: 'このメールアドレスは既に登録されています',
      };
    }

    // Create new user
    const newUser: User = {
      id: Date.now(), // Simple ID generation for mock
      name: data.name,
      email: data.email,
    };

    return {
      success: true,
      user: newUser,
    };
  },
};
