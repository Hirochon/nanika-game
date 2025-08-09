import { redirect } from 'react-router';
import { mockAuthApi } from '~/utils/mock-auth';

const SESSION_KEY = 'nanika_game_user';

export async function getSession(request: Request) {
  // サーバーサイドでは実際のセッションストアを使用する
  // 今回はデモのためlocalStorageの内容をシミュレート
  const cookie = request.headers.get('Cookie');
  if (cookie && cookie.includes(`${SESSION_KEY}=`)) {
    const sessionData = cookie.split(`${SESSION_KEY}=`)[1]?.split(';')[0];
    if (sessionData) {
      try {
        return JSON.parse(decodeURIComponent(sessionData));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function requireAuth(request: Request) {
  const user = await getSession(request);
  if (!user) {
    throw redirect('/login');
  }
  return user;
}

export async function redirectIfAuthenticated(request: Request) {
  const user = await getSession(request);
  if (user) {
    throw redirect('/dashboard');
  }
  return null;
}

export function createSession(user: any) {
  return `${SESSION_KEY}=${encodeURIComponent(JSON.stringify(user))}; Path=/; HttpOnly; SameSite=Lax`;
}

export function destroySession() {
  return `${SESSION_KEY}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
