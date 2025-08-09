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

export interface CurrentUserResponse {
  success: boolean;
  user?: User | null;
  error?: string;
}

/**
 * Mock authentication API for development
 */
export const mockAuthApi = {
  /**
   * Mock login functionality
   */
  async login(data: LoginFormData): Promise<AuthResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock users database
    const users = [
      { id: 1, name: 'Admin User', email: 'admin@example.com', password: 'Admin123' },
      { id: 2, name: 'Test User', email: 'test@example.com', password: 'Test123' },
    ];

    const user = users.find((u) => u.email === data.email && u.password === data.password);

    if (user) {
      const { password: _password, ...userWithoutPassword } = user;

      // Store user in localStorage for session persistence
      localStorage.setItem('nanika_game_user', JSON.stringify(userWithoutPassword));

      return {
        success: true,
        user: userWithoutPassword,
      };
    }

    return {
      success: false,
      error: 'メールアドレスまたはパスワードが正しくありません',
    };
  },

  /**
   * Mock registration functionality
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

    // Store user in localStorage
    localStorage.setItem('nanika_game_user', JSON.stringify(newUser));

    return {
      success: true,
      user: newUser,
    };
  },

  /**
   * Get current user from session
   */
  async getCurrentUser(): Promise<CurrentUserResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const userStr = localStorage.getItem('nanika_game_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        return {
          success: true,
          user,
        };
      } catch {
        // Invalid stored user data
        localStorage.removeItem('nanika_game_user');
      }
    }

    return {
      success: true,
      user: null,
    };
  },

  /**
   * Logout and clear session
   */
  async logout(): Promise<{ success: boolean }> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    localStorage.removeItem('nanika_game_user');

    return { success: true };
  },
};
