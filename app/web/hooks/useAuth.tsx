import { useEffect, useState } from 'react';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Cookieからセッション情報を確認
    const checkAuth = () => {
      const cookies = document.cookie;
      const hasSession = cookies.includes('nanika_game_user=');
      setIsAuthenticated(hasSession);
    };

    checkAuth();
  }, []);

  return { isAuthenticated };
}
