import { useEffect, useState } from 'react';
import { mockAuthApi, type User } from '~/utils/mock-auth';
import type { LoginFormData, RegisterFormData } from '~/utils/validation';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (data: LoginFormData) => Promise<boolean>;
  register: (data: RegisterFormData) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const result = await mockAuthApi.getCurrentUser();
        if (mounted && result.success && result.user) {
          setUser(result.user);
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (data: LoginFormData): Promise<boolean> => {
    console.log('useAuth.login 開始:', data);
    setIsLoading(true);
    setError(null);

    try {
      console.log('mockAuthApi.login 呼び出し中...');
      const result = await mockAuthApi.login(data);
      console.log('mockAuthApi.login 結果:', result);

      if (result.success && result.user) {
        console.log('ユーザー設定:', result.user);
        setUser(result.user);
        console.log('setUser 呼び出し完了');
        return true;
      } else {
        console.log('ログイン失敗:', result.error);
        setError(result.error || 'Login failed');
        return false;
      }
    } catch (_err) {
      console.error('ログインエラー:', _err);
      setError('ログインに失敗しました。再度お試しください。');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterFormData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mockAuthApi.register(data);

      if (result.success && result.user) {
        setUser(result.user);
        return true;
      } else {
        setError(result.error || 'Registration failed');
        return false;
      }
    } catch (_err) {
      setError('登録に失敗しました。再度お試しください。');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
    mockAuthApi.logout();
  };

  const clearError = () => {
    setError(null);
  };

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
}
