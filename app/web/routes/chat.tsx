/**
 * チャット一覧ページ
 * 統合チャットレイアウトの表示とユーザー認証
 */

import { type LoaderFunctionArgs, type MetaFunction, redirect, useLoaderData } from 'react-router';
import { ChatLayout } from '../components/chat/ChatLayout';
import type { User } from '../types/chat-types';

export const meta: MetaFunction = () => {
  return [
    { title: 'チャット - Nanika Game' },
    { name: 'description', content: 'リアルタイムチャット機能' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[Chat Loader] Starting...');

  // セッションCookieをチェック
  const cookie = request.headers.get('Cookie');
  console.log('[Chat Loader] Cookie:', cookie ? 'Present' : 'Missing');

  if (!cookie || !cookie.includes('nanika_game_user=')) {
    console.log('[Chat Loader] No valid session cookie found, redirecting to login');
    return redirect('/login');
  }

  // ユーザー情報を取得
  const sessionData = cookie.split('nanika_game_user=')[1]?.split(';')[0];
  console.log('[Chat Loader] Session data:', sessionData ? 'Found' : 'Not found');

  if (!sessionData) {
    console.log('[Chat Loader] Session data empty, redirecting to login');
    return redirect('/login');
  }

  try {
    const user = JSON.parse(decodeURIComponent(sessionData));
    console.log('[Chat Loader] User parsed:', user);

    // ユーザー情報の型チェック
    if (!user || typeof user.id !== 'number' || !user.name || !user.email) {
      console.log('[Chat Loader] Invalid user data:', user);
      return redirect('/login');
    }

    console.log('[Chat Loader] Successful, returning user:', user);
    return { user };
  } catch (error) {
    console.error('[Chat Loader] Error parsing user data:', error);
    return redirect('/login');
  }
}

export default function Chat() {
  const { user } = useLoaderData<typeof loader>();

  console.log('[Chat Component] Rendering with user:', user);

  return (
    <div className="h-screen">
      <ChatLayout user={user as User} />
    </div>
  );
}
